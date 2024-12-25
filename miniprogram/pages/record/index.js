Page({
  data: {
    records: [],
    friends: [],
    types: ['胜', '负'],
    totalScore: 0,
    canSubmit: false,
    isSubmitting: false
  },

  async onLoad() {
    await this.loadFriends();
  },

  // 加载好友列表
  async loadFriends() {
    try {
      const openId = getApp().globalData.openId;
      const db = wx.cloud.database();
      const { data } = await db.collection('friends')
        .where({
          _openid: openId
        })
        .orderBy('createTime', 'desc')
        .get();
      this.setData({ friends: data });
    } catch (err) {
      console.error('获取好友列表失败', err);
      wx.showToast({
        title: '获取列表失败',
        icon: 'error'
      });
    }
  },

  // 添加记录行
  addRecord() {
    const records = [...this.data.records];
    records.push({
      id: Date.now(),
      friendId: '',
      type: '胜',  // 默认选择"胜"
      score: '',
      friendName: ''
    });
    this.setData({ records });
  },

  // 删除记录行
  deleteRecord(e) {
    const { index } = e.currentTarget.dataset;
    const records = [...this.data.records];
    records.splice(index, 1);
    this.setData({ records }, () => {
      this.calculateTotal();
      this.checkCanSubmit();
    });
  },

  // 选择用户
  onSelectFriend(e) {
    const { index } = e.currentTarget.dataset;
    const { value } = e.detail;
    const records = [...this.data.records];
    const selectedFriend = this.data.friends[value];
    
    // 检查是否已经选择过这个用户
    const isDuplicate = records.some((record, i) => 
      i !== index && record.friendId === selectedFriend._id
    );

    if (isDuplicate) {
      wx.showToast({
        title: '该用户已被选择',
        icon: 'none'
      });
      return;
    }
    
    records[index].friendId = selectedFriend._id;
    records[index].friendName = selectedFriend.name;
    
    this.setData({ records });
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
      this.checkCanSubmit();
    });
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
    const { records, totalScore } = this.data;
    
    // 检查是否所有必填字段都已填写
    const isComplete = records.length > 0 && records.every(record => 
      record.friendId && 
      record.type && 
      record.score && 
      !isNaN(parseFloat(record.score))
    );

    // 检查是否有重复选择的用户
    const selectedIds = records.map(r => r.friendId).filter(id => id);
    const hasDuplicate = selectedIds.length !== new Set(selectedIds).size;

    // 检查总分是否为0
    const isBalanced = totalScore === 0;

    this.setData({ 
      canSubmit: isComplete && !hasDuplicate && isBalanced
    });
  },

  // 提交记录
  async onSubmit() {
    if (!this.data.canSubmit || this.data.isSubmitting) return;

    this.setData({ isSubmitting: true });

    try {
      const db = wx.cloud.database();
      const _ = db.command;
      
      // 1. 预处理对战关系
      const battleResults = new Map(); // 存储用户对战关系
      const userStats = new Map();    // 存储用户统计数据
      
      // 遍历所有记录，计算对战关系
      for (let i = 0; i < this.data.records.length; i++) {
        for (let j = i + 1; j < this.data.records.length; j++) {
          const record1 = this.data.records[i];
          const record2 = this.data.records[j];
          
          // 判断对战结果
          let result1, result2;
          if (record1.type === record2.type) {
            // 如果两人都是胜或都是负，则为平局
            result1 = result2 = 'draw';
          } else {
            // 一胜一负，根据类型判定胜负
            result1 = record1.type === '胜' ? 'win' : 'lose';
            result2 = result1 === 'win' ? 'lose' : 'win';
          }

          // 更新对战关系
          this.updateBattleMap(battleResults, record1.friendId, record2.friendId, result1);
          this.updateBattleMap(battleResults, record2.friendId, record1.friendId, result2);
        }

        // 更新用户统计数据
        const record = this.data.records[i];
        const isWin = record.type === '胜';
        const score = parseFloat(record.score);
        
        if (!userStats.has(record.friendId)) {
          userStats.set(record.friendId, {
            totalScore: 0,
            winCount: 0,
            loseCount: 0
          });
        }
        
        const stats = userStats.get(record.friendId);
        stats.totalScore += isWin ? score : -score;
        stats.winCount += isWin ? 1 : 0;
        stats.loseCount += isWin ? 0 : 1;
      }

      // 2. 批量更新数据库
      const batch = [];

      // 保存原始记录
      batch.push(
        db.collection('game_records').add({
          data: {
            records: this.data.records,
            totalScore: this.data.totalScore,
            createTime: db.serverDate()
          }
        })
      );

      // 更新用户统计数据
      for (const [userId, stats] of userStats) {
        // 先检查用户统计记录是否存在
        const { data: existingStat } = await db.collection('user_stats').where({
          userId: userId
        }).get();

        if (existingStat.length === 0) {
          // 如果不存在，创建新记录
          batch.push(
            db.collection('user_stats').add({
              data: {
                userId: userId,
                totalScore: stats.totalScore,
                winCount: stats.winCount,
                loseCount: stats.loseCount
              }
            })
          );
        } else {
          // 如果存在，更新记录
          batch.push(
            db.collection('user_stats').where({
              userId: userId
            }).update({
              data: {
                totalScore: _.inc(stats.totalScore),
                winCount: _.inc(stats.winCount),
                loseCount: _.inc(stats.loseCount)
              }
            })
          );
        }
      }

      // 更新对战关系
      for (const [userId, opponents] of battleResults) {
        // 将 Map 转换为普通对象
        const relationshipsObj = {};
        for (const [opponentId, stats] of Object.entries(opponents)) {
          relationshipsObj[opponentId] = stats;
        }

        // 先检查用户关系记录是否存在
        const { data: existingRelation } = await db.collection('user_relationships').where({
          _id: userId
        }).get();

        if (existingRelation.length === 0) {
          // 如果不存在，创建新记录
          batch.push(
            db.collection('user_relationships').add({
              data: {
                _id: userId,
                relationships: relationshipsObj  // 使用转换后的对象
              }
            })
          );
        } else {
          // 如果存在，合并现有关系数据
          const existingRelationships = existingRelation[0].relationships || {};
          
          // 合并每个对手的战绩
          for (const [opponentId, stats] of Object.entries(relationshipsObj)) {
            const existing = existingRelationships[opponentId] || {
              winCount: 0,
              loseCount: 0,
              drawCount: 0
            };
            
            relationshipsObj[opponentId] = {
              winCount: existing.winCount + stats.winCount,
              loseCount: existing.loseCount + stats.loseCount,
              drawCount: existing.drawCount + stats.drawCount
            };
          }

          // 更新关系记录
          batch.push(
            db.collection('user_relationships').doc(userId).update({
              data: {
                relationships: relationshipsObj  // 使用转换后的对象
              }
            })
          );
        }
      }

      // 执行所有更新
      await Promise.all(batch);

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

  // 辅助方法：更新对战关系Map
  updateBattleMap(battleResults, userId, opponentId, result) {
    if (!battleResults.has(userId)) {
      battleResults.set(userId, {});
    }
    
    const userRelations = battleResults.get(userId);
    if (!userRelations[opponentId]) {
      userRelations[opponentId] = {
        winCount: 0,
        loseCount: 0,
        drawCount: 0
      };
    }

    const stats = userRelations[opponentId];
    if (result === 'win') {
      stats.winCount++;
    } else if (result === 'lose') {
      stats.loseCount++;
    } else {
      stats.drawCount++;
    }
  },

  // 跳转到添加麻友页面
  goToAddFriend() {
    wx.navigateTo({
      url: '/pages/friend-list/index'
    });
  }
});
