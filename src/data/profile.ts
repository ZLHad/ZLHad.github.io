// Everything about the person. Links left empty are simply not rendered, so
// adding a Google Scholar or ORCID link later means filling in one string.
export const profile = {
  name: { en: 'Linghao Zhang', zh: '张凌豪' },
  email: 'zhanglinghao@njupt.edu.cn',
  emailNus: 'zhanglinghao@u.nus.edu',
  links: {
    github: 'https://github.com/ZLHad',
    scholar: '',
    orcid: '',
    arxiv: 'https://arxiv.org/abs/2603.10808',
    // The IEEE author page still lists a same-name author's paper; fill this in once it is fixed.
    ieee: '',
  },
  role: {
    en: 'Ph.D. candidate, Nanjing University of Posts and Telecommunications. Joint Ph.D. student, National University of Singapore.',
    zh: '南京邮电大学博士研究生，新加坡国立大学联合培养博士生。',
  },
  bio: {
    en: 'I am a Ph.D. candidate in Communication and Information Systems at Nanjing University of Posts and Telecommunications (NJUPT), advised by Prof. Haitao Zhao, and received my B.E. in Electronic Information Engineering from NJUPT in 2023. Since August 2026 I have been a joint Ph.D. student at the National University of Singapore with Prof. Rui Zhang, Fellow of the Academy of Engineering Singapore and IEEE Fellow. I study space-air-ground integrated networks for intelligent connectivity and intelligent services, and recently communication for large-model inference.',
    zh: '我是南京邮电大学通信与信息系统专业博士研究生，导师为赵海涛教授；2023 年在南京邮电大学获电子信息工程专业工学学士学位。2026 年 8 月起，在新加坡国立大学张瑞教授（新加坡工程院院士、IEEE Fellow）课题组联合培养。研究面向智能连接、承载智能业务的空天地一体化网络，近期聚焦面向大模型推理的通信。',
  },
  // The line the work goes by. The first part opens the research page; both sit in the hero.
  thesis: {
    en: ['From delivering bits to serving tokens.', 'Space-air-ground networks for intelligent connectivity and intelligent services, and the laws that govern them once a network delivers inference instead of bits.'],
    zh: ['从“传比特”到“供 Token”。', '面向智能连接、承载智能业务的空天地网络，以及网络从交付比特变为交付推理之后，通、算、智协同所遵循的基本规律。'],
  },
  // The question the work answers. The research page states it and the home page points to it.
  question: {
    en: 'Once networks carry stateful token flows instead of bits, what new laws govern their communication, computing and storage trade-offs, and how can an intent-driven closed loop master them?',
    zh: '网络承载的对象从数据流变成有状态的 Token 流之后，通、算、存的权衡遵循什么新规律，又该怎样用意图驱动的闭环去驾驭？',
  },
  // The short version beside the paper list; the hero has already said where.
  about: {
    en: [
      'I am a Ph.D. candidate in Communication and Information Systems at Nanjing University of Posts and Telecommunications (NJUPT), advised by Prof. Haitao Zhao. I received my B.E. in Electronic Information Engineering from NJUPT in 2023. Since August 2026 I have been a joint Ph.D. student at the National University of Singapore, in the group of Prof. Rui Zhang, Fellow of the Academy of Engineering Singapore and IEEE Fellow.',
      'I study space-air-ground integrated networks for intelligent connectivity and intelligent services. As networks shift from delivering bits to delivering inference, I ask what laws govern the trade-offs among communication, computing and intelligence, and how a closed loop can steer them. My work covers token-aware multimodal inference, prediction-augmented offloading, hierarchical split federated learning across space, air and ground, and agentic AI for network resource management. My recent focus is communication-computing co-design for large-model inference.',
    ],
    zh: [
      '我是南京邮电大学通信与信息系统专业博士研究生，导师为赵海涛教授；2023 年在南京邮电大学获电子信息工程专业工学学士学位。2026 年 8 月起，在新加坡国立大学张瑞教授（新加坡工程院院士、IEEE Fellow）课题组联合培养。',
      '我研究面向智能连接、承载智能业务的空天地一体化网络。网络交付的对象正从比特变为推理，我关心其中的基础问题：通信、计算与智能之间的权衡遵循什么规律，又该如何闭环驾驭。已有工作覆盖 Token 感知的多模态推理编排、任务预测增强的协同卸载、空天地分层拆分联邦学习，以及用智能体 AI 管理网络资源；近期聚焦面向大模型推理的通信-计算融合优化。',
    ],
  },
  education: [
    {
      period: '2026.08 — 2027.07',
      place: { en: 'National University of Singapore', zh: '新加坡国立大学' },
      what: { en: 'Joint Ph.D. student', zh: '联合培养博士研究生' },
      who: { en: 'Host: Prof. Rui Zhang, Fellow of the Academy of Engineering Singapore, IEEE Fellow', zh: '合作导师：张瑞教授，新加坡工程院院士、IEEE Fellow' },
    },
    {
      period: '2023.09 — 2028.06 (expected)',
      place: { en: 'Nanjing University of Posts and Telecommunications', zh: '南京邮电大学' },
      what: { en: 'Ph.D. candidate, Communication and Information Systems', zh: '博士研究生，通信与信息系统' },
      who: { en: 'Advisor: Prof. Haitao Zhao', zh: '导师：赵海涛教授' },
    },
    {
      period: '2019.09 — 2023.06',
      place: { en: 'Nanjing University of Posts and Telecommunications', zh: '南京邮电大学' },
      what: { en: 'B.E., Electronic Information Engineering', zh: '工学学士，电子信息工程' },
      who: null,
    },
  ],
} as const;
