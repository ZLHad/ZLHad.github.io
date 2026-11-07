// The columns of the research drawing, in order. A paper's `mechanism` field names one of
// these, or `control` for the control plane above them. To add a column, add one line to
// each list; the drawing, the chart on the home page and the heading follow.
export const mechanismKeys = ['control', 'offload', 'infer', 'train'] as const;

export const mechanisms = [
  { key: 'offload', name: { en: 'Offload accurately', zh: '分得准' }, q: { en: 'Send bursty, heterogeneous tasks to the device, the UAV or the satellite?', zh: '异构突发任务交给终端、无人机还是卫星？' } },
  { key: 'infer', name: { en: 'Infer fast', zh: '算得快' }, q: { en: 'Infer on the UAV or the LEO satellite? How much token compression is fast yet good?', zh: '在 UAV 还是 LEO 上推理？Token 压缩多少又快又好？' } },
  { key: 'train', name: { en: 'Train efficiently', zh: '训得出' }, q: { en: 'Weak devices, scattered data: how to co-train models?', zh: '终端算力弱、数据分散，模型如何协同训练与更新？' } },
];
