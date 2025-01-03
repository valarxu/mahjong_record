Page({
  data: {
    userInfo: null
  },

  onLoad: function() {
    // 获取用户信息
    const userInfo = getApp().globalData.userInfo;
    this.setData({ userInfo });
  },

  // 记录按钮点击事件
  onRecord() {
    wx.navigateTo({
      url: '/pages/record/index'
    });
  },

  // 查看历史按钮点击事件
  onViewHistory() {
    wx.navigateTo({
      url: '/pages/history/index'
    });
  },

  // 跳转到麻友列表
  onFriendList() {
    wx.navigateTo({
      url: '/pages/friend-list/index'
    });
  },

  // 添加对战统计按钮点击事件
  onBattleStats() {
    wx.navigateTo({
      url: '/pages/battle-stats/index'
    });
  },

  // 添加转发功能
  onShareAppMessage() {
    return {
      title: '麻将计分器',
      path: '/pages/index/index',
      imageUrl: '/images/homepage.jpg'  // 可以添加一张分享图片
    };
  },

  // 添加分享到朋友圈
  onShareTimeline() {
    return {
      title: '麻将计分器',
      query: '',
      imageUrl: '/images/homepage.jpg'  // 可以添加一张分享图片
    };
  }
})
