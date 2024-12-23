// app.js
App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: "",
        traceUser: true,
      });
    }

    // 检查登录状态
    this.checkLogin();
  },
  globalData: {
    userInfo: null
  },
  checkLogin: function() {
    // 获取登录状态
    wx.getStorage({
      key: 'userInfo',
      success: (res) => {
        this.globalData.userInfo = res.data;
      },
      fail: () => {
        // 未找到登录信息,需要重新登录
        wx.redirectTo({
          url: '/pages/auth/index'
        });
      }
    });
  }
});
