Page({
  data: {
    records: [],
    friends: [],
    types: ['胜', '负'],
    totalScore: 0,
    canSubmit: false,
    isSubmitting: false,
    availableFriends: []
  },

  async onLoad() {
    await this.loadFriends();
    this.calculateTotal();
  },

  // 加载好友列表
  async loadFriends() {
    try {
      const db = wx.cloud.database();
      const { data } = await db.collection('friends')
        .orderBy('createTime', 'desc')
        .get();

      this.setData({ friends: data });
    } catch (err) {
      console.error('获取好友列表失败', err);
      wx.showToast({
        title: '获取好友失败',
        icon: 'error'
      });
    }
  },

  // 添加一行记录
  addRecord() {
    const records = [...this.data.records];
    records.push({
      id: Date.now(), // 临时ID
      friendId: '',
      type: '胜',  // 默认选择"胜"
      score: '',
      friendName: ''
    });
    
    // 更新可选好友列表
    const availableFriends = this.getAvailableFriends(records.length - 1);
    
    this.setData({ 
      records,
      availableFriends
    });
  },

  // 删除一行记录
  deleteRecord(e) {
    const { index } = e.currentTarget.dataset;
    const records = [...this.data.records];
    records.splice(index, 1);
    
    // 更新可选好友列表
    const availableFriends = records.length > 0 ? 
      this.getAvailableFriends(records.length - 1) : 
      this.data.friends;
    
    this.setData({ 
      records,
      availableFriends
    }, () => {
      this.calculateTotal();
    });
  },

  // 选择用户
  onSelectFriend(e) {
    const { index } = e.currentTarget.dataset;
    const { value } = e.detail;
    const records = [...this.data.records];
    
    // 使用当前行可选的好友列表
    const availableFriends = this.getAvailableFriends(index);
    const selectedFriend = availableFriends[value];
    
    records[index].friendId = selectedFriend._id;
    records[index].friendName = selectedFriend.name;
    
    this.setData({ 
      records,
      availableFriends
    });
    this.checkCanSubmit();
  },

  // 选择类型
  onSelectType(e) {
    const { index } = e.currentTarget.dataset;
    const { value } = e.detail;
    const records = [...this.data.records];
    records[index].type = this.data.types[value];
    
    this.setData({ records }, () => {
      this.calculateTotal();
    });
    this.checkCanSubmit();
  },

  // 输入分数
  onInputScore(e) {
    const { index } = e.currentTarget.dataset;
    let { value } = e.detail;
    
    // 限制最大8位数
    if (value) {
      value = value.replace(/[^\d.]/g, '');  // 只允许数字和小数点
      const parts = value.split('.');
      if (parts[0] && parts[0].length > 8) {
        parts[0] = parts[0].slice(0, 8);
      }
      if (parts[1]) {
        parts[1] = parts[1].slice(0, 2);  // 保留两位小数
      }
      value = parts.join('.');
    }

    const records = [...this.data.records];
    records[index].score = value;
    
    this.setData({ records }, () => {
      this.calculateTotal();
      this.checkCanSubmit();
    });
  },

  // 计算总分
  calculateTotal() {
    let total = 0;
    this.data.records.forEach(record => {
      if (!record.score) return;
      const score = parseFloat(record.score) || 0;
      total += record.type === '胜' ? score : -score;
    });
    this.setData({ totalScore: total });
  },

  // 检查是否可以提交
  checkCanSubmit() {
    const { records } = this.data;
    const canSubmit = records.length > 0 && records.every(record => 
      record.friendId && 
      record.type && 
      record.score && 
      !isNaN(parseFloat(record.score))
    );
    this.setData({ canSubmit });
  },

  // 提交记录
  async onSubmit() {
    if (!this.data.canSubmit || this.data.isSubmitting) return;

    this.setData({ isSubmitting: true });

    try {
      const db = wx.cloud.database();
      const _ = db.command;
      
      // 1. 保存原始记录
      await db.collection('game_records').add({
        data: {
          records: this.data.records,
          totalScore: this.data.totalScore,
          createTime: db.serverDate()
        }
      });

      // 2. 获取所有涉及的用户ID
      const userIds = [...new Set(this.data.records.map(r => r.friendId))];
      
      // 3. 一次性获取所有用户的统计数据
      const { data: existingStats } = await db.collection('user_stats')
        .where({
          userId: _.in(userIds)
        })
        .get();

      // 4. 准备用户统计数据的更新操作
      const statsUpdates = [];
      const statsCreates = [];
      
      userIds.forEach(userId => {
        // 计算用户的所有记录
        const userRecords = this.data.records.filter(r => r.friendId === userId);
        const stats = {
          totalScore: 0,
          winCount: 0,
          loseCount: 0
        };
        
        userRecords.forEach(record => {
          const isWin = record.type === '胜';
          const score = parseFloat(record.score);
          stats.totalScore += isWin ? score : -score;
          stats.winCount += isWin ? 1 : 0;
          stats.loseCount += isWin ? 0 : 1;
        });

        const existingStat = existingStats.find(s => s.userId === userId);
        if (existingStat) {
          statsUpdates.push({
            userId,
            updates: {
              totalScore: _.inc(stats.totalScore),
              winCount: _.inc(stats.winCount),
              loseCount: _.inc(stats.loseCount)
            }
          });
        } else {
          statsCreates.push({
            userId,
            totalScore: stats.totalScore,
            winCount: stats.winCount,
            loseCount: stats.loseCount
          });
        }
      });

      // 5. 计算对战关系更新
      const relationshipUpdates = this.calculateNewRelationships(this.data.records);
      
      // 6. 获取所有涉及用户的现有关系记录
      const { data: existingRelations } = await db.collection('user_relationships')
        .where({
          _id: _.in(userIds)
        })
        .get();

      // 7. 准备关系数据的更新操作
      const relationUpdates = [];
      const relationCreates = [];

      // 处理每个用户的关系更新
      userIds.forEach(userId => {
        const updates = relationshipUpdates[userId];
        const existingRelation = existingRelations.find(r => r._id === userId);

        if (existingRelation) {
          // 合并现有关系和新关系
          const currentRelations = JSON.parse(existingRelation.relationships || '{}');
          Object.entries(updates).forEach(([targetId, changes]) => {
            if (!currentRelations[targetId]) {
              currentRelations[targetId] = { winCount: 0, loseCount: 0, drawCount: 0 };
            }
            currentRelations[targetId].winCount += changes.win;
            currentRelations[targetId].loseCount += changes.lose;
            currentRelations[targetId].drawCount += changes.draw;
          });

          relationUpdates.push({
            _id: userId,
            relationships: JSON.stringify(currentRelations)
          });
        } else {
          // 创建新的关系记录
          const newRelations = {};
          Object.entries(updates).forEach(([targetId, changes]) => {
            newRelations[targetId] = {
              winCount: changes.win,
              loseCount: changes.lose,
              drawCount: changes.draw
            };
          });

          relationCreates.push({
            _id: userId,
            relationships: JSON.stringify(newRelations)
          });
        }
      });

      // 8. 执行所有更新操作
      const updatePromises = [
        // 批量创建用户统计
        ...statsCreates.map(stat => 
          db.collection('user_stats').add({ data: stat })
        ),
        // 批量更新用户统计
        ...statsUpdates.map(update =>
          db.collection('user_stats')
            .where({ userId: update.userId })
            .update({ data: update.updates })
        ),
        // 批量创建关系记录
        ...relationCreates.map(relation =>
          db.collection('user_relationships').add({ data: relation })
        ),
        // 批量更新关系记录
        ...relationUpdates.map(update =>
          db.collection('user_relationships')
            .doc(update._id)
            .update({ data: { relationships: update.relationships } })
        )
      ];

      await Promise.all(updatePromises);

      wx.showToast({
        title: '提交成功',
        icon: 'success'
      });

      // 清空记录
      this.setData({
        records: [],
        totalScore: 0,
        canSubmit: false
      });

    } catch (err) {
      console.error('提交失败', err);
      wx.showToast({
        title: '提交失败',
        icon: 'error'
      });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  // 计算新的对战关系
  calculateNewRelationships(records) {
    const relationships = {};
    const players = records.map(r => ({
      id: r.friendId,
      type: r.type
    }));

    // 遍历所有玩家组合
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const playerA = players[i];
        const playerB = players[j];
        
        // 初始化关系对象
        if (!relationships[playerA.id]) relationships[playerA.id] = {};
        if (!relationships[playerB.id]) relationships[playerB.id] = {};
        
        // 如果两个玩家状态相同（都是胜或都是负），则为平局
        if (playerA.type === playerB.type) {
          // 更新A对B的关系
          relationships[playerA.id][playerB.id] = {
            win: 0,
            lose: 0,
            draw: 1
          };
          // 更新B对A的关系
          relationships[playerB.id][playerA.id] = {
            win: 0,
            lose: 0,
            draw: 1
          };
        } else {
          // 状态不同时，胜者���负者记为胜，负者对胜者记为负
          const aWins = playerA.type === '胜';
          // 更新A对B的关系
          relationships[playerA.id][playerB.id] = {
            win: aWins ? 1 : 0,
            lose: aWins ? 0 : 1,
            draw: 0
          };
          // 更新B对A的关系
          relationships[playerB.id][playerA.id] = {
            win: aWins ? 0 : 1,
            lose: aWins ? 1 : 0,
            draw: 0
          };
        }
      }
    }

    return relationships;
  },

  // 获取可选择的好友列表
  getAvailableFriends(currentIndex) {
    // 获取所有已选择的好友ID（排除当前项）
    const selectedIds = this.data.records
      .filter((_, index) => index !== parseInt(currentIndex))  // 确保 currentIndex 是数字
      .map(record => record.friendId)
      .filter(id => id); // 过滤掉空值

    // 返回未被选择的好友列表
    return this.data.friends.filter(friend => !selectedIds.includes(friend._id));
  }
}); 