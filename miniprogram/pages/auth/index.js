Page({
  data: {
  },

  getUserProfile() {
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        const userInfo = res.userInfo;
        
        // 保存用户信息到本地存储
        wx.setStorage({
          key: 'userInfo',
          data: userInfo,
          success: () => {
            // 保存到全局数据
            getApp().globalData.userInfo = userInfo;
            
            // 跳转到首页
            wx.reLaunch({
              url: '/pages/index/index'
            });
          }
        });
      },
      fail: (err) => {
        console.error('获取用户信息失败', err);
        wx.showToast({
          title: '需要授权才能使用',
          icon: 'none'
        });
      }
    });
  }
}); 