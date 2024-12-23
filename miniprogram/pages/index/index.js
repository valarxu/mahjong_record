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
  }
})
