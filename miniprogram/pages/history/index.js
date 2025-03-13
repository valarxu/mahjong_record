Page({
  data: {
    records: [],
    loading: false,
    hasMore: true,
    pageSize: 10,
    currentPage: 0,
    selectMode: false,
    showStats: false,
    statsResult: []
  },

  onLoad() {
    this.loadRecords(true);
  },

  // 下拉刷新
  async onPullDownRefresh() {
    await this.loadRecords(true);
    wx.stopPullDownRefresh();
  },

  // 上拉加载更多
  async onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      await this.loadRecords();
    }
  },

  // 加载记录
  async loadRecords(refresh = false) {
    if (this.data.loading) return;

    this.setData({ loading: true });

    try {
      const db = wx.cloud.database();
      const pageSize = this.data.pageSize;
      const skip = refresh ? 0 : this.data.records.length;

      const { data } = await db.collection('game_records')
        .orderBy('createTime', 'desc')
        .skip(skip)
        .limit(pageSize)
        .get();

      // 格式化记录数据
      const formattedData = data.map(record => ({
        ...record,
        createTime: this.formatTime(record.createTime),
        records: this.formatRecords(record.records),
        checked: false
      }));

      this.setData({
        records: refresh ? formattedData : [...this.data.records, ...formattedData],
        currentPage: refresh ? 1 : this.data.currentPage + 1,
        hasMore: data.length === pageSize,
        loading: false
      });

    } catch (err) {
      console.error('获取历史记录失败', err);
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      });
      this.setData({ loading: false });
    }
  },

  // 格式化时间
  formatTime(dateStr) {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  },

  // 格式化记录
  formatRecords(records) {
    return records.map(record => ({
      ...record,
      scoreText: `${record.type === '胜' ? '+' : '-'}${record.score}`
    }));
  },

  // 进入选择模式
  enterSelectMode() {
    this.setData({
      selectMode: true,
      showStats: false
    });
  },

  // 取消选择模式
  cancelSelectMode() {
    // 重置所有选中状态
    const records = this.data.records.map(item => ({
      ...item,
      checked: false
    }));

    this.setData({
      selectMode: false,
      records,
      showStats: false
    });
  },

  // 切换选中状态
  toggleSelect(e) {
    const id = e.currentTarget.dataset.id;
    const records = this.data.records.map(item => {
      if (item._id === id) {
        return {
          ...item,
          checked: !item.checked
        };
      }
      return item;
    });

    this.setData({ records });
  },

  // 计算统计结果
  calculateStats() {
    const selectedRecords = this.data.records.filter(item => item.checked);
    
    if (selectedRecords.length === 0) {
      wx.showToast({
        title: '请选择记录',
        icon: 'none'
      });
      return;
    }

    // 收集每个玩家的分数记录
    const playerStatsMap = new Map();
    
    selectedRecords.forEach(record => {
      record.records.forEach(detail => {
        const key = detail.friendName;
        const score = detail.type === '胜' ? Number(detail.score) : -Number(detail.score);
        
        if (!playerStatsMap.has(key)) {
          playerStatsMap.set(key, {
            id: key,
            friendName: key,
            scores: [],
            totalScore: 0
          });
        }
        
        playerStatsMap.get(key).scores.push(score);
        playerStatsMap.get(key).totalScore += score;
      });
    });

    // 转换为数组并排序
    const statsResult = Array.from(playerStatsMap.values())
      .sort((a, b) => Math.abs(b.totalScore) - Math.abs(a.totalScore));

    this.setData({
      statsResult,
      showStats: true
    });
  },

  // 关闭统计结果
  closeStats() {
    this.setData({
      showStats: false
    });
  },
  
  // 防止点击弹窗内容时关闭弹窗
  preventClose() {
    // catchtap 已经阻止了事件冒泡，不需要额外操作
  }
}); 