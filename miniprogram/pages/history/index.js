Page({
  data: {
    records: [],
    loading: false,
    hasMore: true,
    pageSize: 10,
    currentPage: 0
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
        records: this.formatRecords(record.records)
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
  }
}); 