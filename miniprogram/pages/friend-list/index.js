import { animalEmojis, getRandomEmoji } from '../../utils/emoji';

Page({
  data: {
    friends: [],
    loading: true,
    friendName: '',
    isSubmitting: false,
    editingId: '',
    editingName: '',
    editingEmoji: '',
    userOpenId: '',
    showEmojiPicker: false,
    animalEmojis,
    currentEmoji: getRandomEmoji(),  // 默认选择一个随机emoji
    isEditing: false,  // 新增编辑状态标记
  },

  onLoad() {
  },

  // 输入框内容变化
  onInput(e) {
    this.setData({
      friendName: e.detail.value
    });
  },

  // 编辑时输入框内容变化
  onEditInput(e) {
    this.setData({
      editingName: e.detail.value
    });
  },

  // 加载麻友列表
  async loadFriends() {
    this.setData({ loading: true });
    try {
      const db = wx.cloud.database();
      const { data } = await db.collection('friends')
        .orderBy('createTime', 'desc')
        .get();

      this.setData({ 
        friends: data,
        loading: false
      });
    } catch (err) {
      console.error('获取麻友列表失败', err);
      wx.showToast({
        title: '获取列表失败',
        icon: 'error'
      });
      this.setData({ loading: false });
    }
  },

  // 添加麻友
  async onAddFriend() {
    const friendName = this.data.friendName.trim();
    if (!friendName) {
      wx.showToast({
        title: '请输入麻友姓名',
        icon: 'none'
      });
      return;
    }

    this.setData({ isSubmitting: true });

    try {
      const db = wx.cloud.database();
      await db.collection('friends').add({
        data: {
          name: friendName,
          emoji: this.data.currentEmoji,
          createTime: db.serverDate()
        }
      });

      wx.showToast({
        title: '添加成功',
        icon: 'success'
      });

      this.setData({ 
        friendName: '',
        currentEmoji: getRandomEmoji() // 重新随机一个emoji
      });
      this.loadFriends();

    } catch (err) {
      console.error('添加失败', err);
      wx.showToast({
        title: '添加失败',
        icon: 'error'
      });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  // 开始编辑
  onEdit(e) {
    const { id, name, emoji } = e.currentTarget.dataset;
    this.setData({
      editingId: id,
      editingName: name,
      editingEmoji: emoji,
      isEditing: true
    });
  },

  // 显示emoji选择器
  showEmojiPicker(e) {
    const { emoji } = e.currentTarget.dataset;
    this.setData({ 
      showEmojiPicker: true,
      currentEmoji: emoji || this.data.currentEmoji
    });
  },

  // 选择emoji
  onSelectEmoji(e) {
    const { emoji } = e.currentTarget.dataset;
    if (this.data.isEditing) {
      // 编辑状态下，只更新 editingEmoji
      this.setData({
        editingEmoji: emoji,
        showEmojiPicker: false
      });
    } else {
      // 新增状态下，只更新 currentEmoji
      this.setData({
        currentEmoji: emoji,
        showEmojiPicker: false
      });
    }
  },

  // 关闭emoji选择器
  onEmojiPickerClose() {
    this.setData({
      showEmojiPicker: false
    });
  },

  // 阻止冒泡
  stopPropagation() {
    return;
  },

  // 保存编辑
  async onSave() {
    const newName = this.data.editingName.trim();
    if (!newName) {
      wx.showToast({
        title: '名字不能为空',
        icon: 'none'
      });
      return;
    }

    try {
      const db = wx.cloud.database();
      const { data } = await db.collection('friends').doc(this.data.editingId).get();
      
      if (!data || data._openid !== this.data.userOpenId) {
        wx.showToast({
          title: '无权修改',
          icon: 'error'
        });
        return;
      }

      await db.collection('friends').doc(this.data.editingId).update({
        data: {
          name: newName,
          emoji: this.data.editingEmoji
        }
      });

      wx.showToast({
        title: '修改成功',
        icon: 'success'
      });

      this.loadFriends();
    } catch (err) {
      console.error('修改失败', err);
      wx.showToast({
        title: '修改失败',
        icon: 'error'
      });
    } finally {
      this.setData({
        editingId: '',
        editingName: '',
        editingEmoji: '',
        isEditing: false
      });
    }
  },

  // 取消编辑
  onCancelEdit() {
    this.setData({
      editingId: '',
      editingName: '',
      editingEmoji: '',
      isEditing: false
    });
  },

  // 删除麻友
  onDelete(e) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个麻友吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const db = wx.cloud.database();
            // 先检查是否是自己创建的记录
            const { data } = await db.collection('friends').doc(id).get();
            
            if (!data || data._openid !== this.data.userOpenId) {
              wx.showToast({
                title: '无权删除',
                icon: 'error'
              });
              return;
            }

            await db.collection('friends').doc(id).remove();
            
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            });

            this.loadFriends();
          } catch (err) {
            console.error('删除失败', err);
            wx.showToast({
              title: '删除失败',
              icon: 'error'
            });
          }
        }
      }
    });
  },

  // 在页面加载时获取用户openid
  async onLoad() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'getOpenId'
      });
      this.setData({
        userOpenId: result.openid
      });
    } catch (err) {
      console.error('获取用户ID失败', err);
    }
    await this.loadFriends();
  }
}); 