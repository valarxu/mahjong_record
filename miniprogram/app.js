// app.js
App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: "xjz-env-3g3yobjr79bd692b",
        traceUser: true,
      });
    }

    // 检查登录状态
    this.checkLogin();
  },

  globalData: {
    userInfo: null,
    openId: null
  },

  checkLogin: async function() {
    try {
      // 先从缓存获取用户信息和openId
      const userInfo = wx.getStorageSync('userInfo');
      const openId = wx.getStorageSync('openId');

      if (userInfo && openId) {
        this.globalData.userInfo = userInfo;
        this.globalData.openId = openId;
      } else {
        // 未找到登录信息,需要重新登录
        wx.redirectTo({
          url: '/pages/auth/index'
        });
      }
    } catch (err) {
      console.error('检查登录状态失败', err);
      wx.redirectTo({
        url: '/pages/auth/index'
      });
    }
  }
});
