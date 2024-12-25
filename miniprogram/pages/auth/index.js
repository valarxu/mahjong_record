Page({
  data: {
  },

  async getUserProfile() {
    try {
      // 获取用户信息
      const { userInfo } = await wx.getUserProfile({
        desc: '用于完善用户资料'
      });

      // 获取openId
      const { result } = await wx.cloud.callFunction({
        name: 'getOpenId'
      });

      const openId = result.openid;

      // 保存用户信息和openId到本地存储
      wx.setStorageSync('userInfo', userInfo);
      wx.setStorageSync('openId', openId);

      // 保存到全局数据
      getApp().globalData.userInfo = userInfo;
      getApp().globalData.openId = openId;

      // 跳转到首页
      wx.reLaunch({
        url: '/pages/index/index'
      });
    } catch (err) {
      console.error('授权失败', err);
      wx.showToast({
        title: '授权失败',
        icon: 'none'
      });
    }
  }
}); 