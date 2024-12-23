Page({
  data: {
    friends: [],
    expandedUserId: '',
    battleStats: []
  },

  async onLoad() {
    await this.loadFriends();
  },

  // 加载好友列表
  async loadFriends() {
    try {
      const db = wx.cloud.database();
      // 获取好友列表
      const { data: friends } = await db.collection('friends')
        .orderBy('createTime', 'desc')
        .get();

      // 获取所有用户的统计数据
      const { data: stats } = await db.collection('user_stats')
        .where({
          userId: db.command.in(friends.map(f => f._id))
        })
        .get();

      // 合并好友信息和统计数据
      const friendsWithStats = friends.map(friend => {
        const userStats = stats.find(s => s.userId === friend._id) || {
          totalScore: 0,
          winCount: 0,
          loseCount: 0
        };
        return {
          ...friend,
          totalScore: userStats.totalScore,
          winCount: userStats.winCount,
          loseCount: userStats.loseCount
        };
      });

      this.setData({ friends: friendsWithStats });
    } catch (err) {
      console.error('获取好友列表失败', err);
      wx.showToast({
        title: '获取列表失败',
        icon: 'error'
      });
    }
  },

  // 展开/收起用户对战信息
  async onToggleUser(e) {
    const { userid: userId } = e.currentTarget.dataset;
    
    if (this.data.expandedUserId === userId) {
      // 如果点击的是当前展开的用户，则收起
      this.setData({ 
        expandedUserId: '',
        battleStats: []
      });
      return;
    }

    // 加载该用户的对战统计
    try {
      const db = wx.cloud.database();
      const { data: relationships } = await db.collection('user_relationships')
        .where({
          _id: userId
        })
        .get();

      if (relationships.length === 0) {
        wx.showToast({
          title: '暂无对战记录',
          icon: 'none'
        });
        return;
      }

      const relation = relationships[0];
      const stats = relation.relationships || {};
      
      // 转换统计数据为展示格式
      const battleStats = await this.formatBattleStats(stats);

      this.setData({
        expandedUserId: userId,
        battleStats
      });

    } catch (err) {
      console.error('获取对战统计失败', err);
      wx.showToast({
        title: '获取统计失败',
        icon: 'error'
      });
    }
  },

  // 格式化对战统计数据
  formatBattleStats(stats) {
    const formattedStats = [];

    for (const [opponentId, record] of Object.entries(stats)) {
      // 从已加载的好友列表中查找对手信息
      const opponent = this.data.friends.find(f => f._id === opponentId);
      if (!opponent) continue;

      const total = record.winCount + record.loseCount + record.drawCount;
      formattedStats.push({
        id: opponentId,
        name: opponent.name,
        winCount: record.winCount,
        loseCount: record.loseCount,
        drawCount: record.drawCount,
        winPercent: (record.winCount / total) * 100,
        drawPercent: (record.drawCount / total) * 100,
        losePercent: (record.loseCount / total) * 100
      });
    }

    return formattedStats;
  }
}); 