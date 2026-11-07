export type Lang = 'en' | 'zh';
export type Text = { en: string; zh: string };

export const pick = <T,>(value: { en: T; zh: T }, lang: Lang): T => value[lang];

/** Root-relative URL for a page in the given language. */
export const href = (lang: Lang, path = '/') => (lang === 'zh' ? `/zh${path}` : path);

/** The same page in the other language. */
export const otherLangPath = (lang: Lang, pathname: string) => {
  const stripped = pathname.replace(/^\/zh(?=\/|$)/, '') || '/';
  const clean = stripped.startsWith('/404') ? '/' : stripped; // the error page has one version
  return lang === 'zh' ? clean : `/zh${clean}`;
};

/** The page of a paper; a normal click on it opens the popup instead. */
export const paperHref = (lang: Lang, slug: string) => href(lang, `/publications/${slug}/`);

export const langPaths = () => [{ params: { lang: undefined } }, { params: { lang: 'zh' } }];
export const toLang = (param: string | undefined): Lang => (param === 'zh' ? 'zh' : 'en');

const strings = {
  en: {
    siteTitle: 'Linghao Zhang — space-air-ground networks, edge intelligence, agentic AI',
    siteDesc:
      'Linghao Zhang is a Ph.D. candidate at NJUPT and a joint Ph.D. student at NUS, studying space-air-ground networks for intelligent connectivity and intelligent services.',
    close: 'Close',
    switchLang: '中文',
    switchLangLabel: 'Read this page in Chinese',
    skip: 'Skip to content',
    home: 'Home',
    publications: 'Publications',
    projects: 'Projects',
    research: 'Research',
    cv: 'CV',
    github: 'GitHub',
    email: 'Email',
    overview: 'Overview',
    deepDive: 'Deep dive',
    abstract: 'Abstract',
    cite: 'Cite',
    mainFigures: 'Main figures',
    firstPage: 'First page',
    copy: 'Copy',
    copyFailed: 'Press Ctrl/Cmd + C',
    more: 'Show the rest',
    selected: 'Selected publications',
    news: 'News',
    soleAuthor: 'Sole author',
    code: 'Code',
    data: 'Data',
    pdf: 'PDF',
    site: 'Site',
    copied: 'Copied',
    firstAuthor: 'First author',
    all: 'All',
    journals: 'Journals',
    conferences: 'Conferences',
    status: {
      published: 'Published',
      'early-access': 'Early Access',
      'online-first': 'Online first',
      preprint: 'Preprint',
    },
    tiers: { space: 'Space', air: 'Air', ground: 'Ground' },
    backHome: 'Back to publications',
  },
  zh: {
    siteTitle: '张凌豪：空天地一体化网络、边缘智能与智能体 AI',
    siteDesc: '张凌豪，南京邮电大学博士研究生、新加坡国立大学联合培养博士生，研究面向智能连接、承载智能业务的空天地网络。',
    close: '关闭',
    switchLang: 'EN',
    switchLangLabel: 'Read this page in English',
    skip: '跳到正文',
    home: '首页',
    publications: '论文',
    projects: '项目',
    research: '研究',
    cv: '简历',
    github: 'GitHub',
    email: '邮箱',
    overview: '概览',
    deepDive: '深入解读',
    abstract: '摘要',
    cite: '引用',
    mainFigures: '主要图片',
    firstPage: '首页',
    copy: '复制',
    copyFailed: '请按 Ctrl/Cmd + C',
    more: '展开全部',
    selected: '代表论文',
    news: '近况',
    soleAuthor: '独立作者',
    code: '代码',
    data: '数据',
    pdf: 'PDF',
    site: '网站',
    copied: '已复制',
    firstAuthor: '第一作者',
    all: '全部',
    journals: '期刊',
    conferences: '会议',
    status: {
      published: '已发表',
      'early-access': 'Early Access',
      'online-first': '网络首发',
      preprint: '预印本',
    },
    tiers: { space: '天', air: '空', ground: '地' },
    backHome: '回到论文列表',
  },
} as const;

export const ui = (lang: Lang) => strings[lang];
