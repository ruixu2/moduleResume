/* moduleResume · 初始数据（仅首次运行时写入 data/ 目录，之后不会覆盖用户修改）

   ⚠ 本文件全部为「通用示例数据」，不含任何真实个人信息。
    首次启动后请到「基础信息 / 素材块库」替换为你自己的内容。

  blocks     素材块库（唯一事实来源）；type 取值：
             summary | education | advisor | thesis | skill | project | internship | academic_service | award | paper | unpublished_paper | patent | custom
  variants   岗位定制版本：sections[].items[] 通过 bid 引用素材块，ov 做版本级覆盖
  applications 投递记录
*/

/* 默认不内置证件照（首次运行无照片）；可在「基础信息」页上传 */
const PHOTO_B64 = '';

const SEED = {
  profile: {
    name: '张三',
    gender: '男',
    birth: '2000年1月',
    hometown: '示例市',
    political: '群众',
    ethnicity: '汉族',
    phone: '13800000000',
    email: 'zhangsan@example.com',
    location: '示例市',
    wechat: '',
    website: '',
    photo: '',
    photos: [],
    photoId: '',
  },

  blocks: [
    /* ---------- 个人总结 ---------- */
    {
      id: 'blk-summary-01', type: 'summary', title: '个人总结（示例）', tags: ['示例'], group: '',
      content: {
        text: '示例大学计算机科学与技术博士（硕博连读），研究方向为机器学习与数据建模。'
          + '参与国家/省级科研课题及企业合作项目，负责算法开发与数据分析；'
          + '以第一作者发表论文 2 篇，参与发明专利 2 项。熟练使用 Python / PyTorch / SQL，'
          + '具备良好的中英文文献研读与科技写作能力。（请替换为你的真实总结）',
      },
    },

    /* ---------- 教育背景 ---------- */
    {
      id: 'blk-edu-phd', type: 'education', title: '博士 · 示例大学 计算机学院', tags: ['博士', '计算机'], group: '',
      content: { start: '2022-09', end: '2026-06', dates: '2022.09 – 2026.06', school: '示例大学', college: '计算机学院', major: '计算机科学与技术', degreeType: '博士（硕博连读）', advisor: '' },
    },
    {
      id: 'blk-edu-bs', type: 'education', title: '本科 · 示例大学 信息学院', tags: ['本科', '计算机'], group: '',
      content: { start: '2018-09', end: '2022-06', dates: '2018.09 – 2022.06', school: '示例大学', college: '信息学院', major: '计算机科学与技术', degreeType: '本科', advisor: '' },
    },
    {
      id: 'blk-advisor-phd', type: 'advisor', title: '博士阶段导师 · 李明', tags: ['博士导师', '示例'], group: '',
      content: {
        name: '李明', relationship: '博士阶段导师', academicTitle: '教授', position: '实验室主任',
        organization: '示例大学', college: '计算机学院',
        research: '机器学习、数据智能与智能系统', contact: '', homepage: '',
        brief: '示例导师信息，请替换为真实内容；可嵌入学历，也可作为独立板块展示。',
      },
    },
    {
      id: 'blk-thesis-phd', type: 'thesis', title: '示例博士学位论文：面向 XX 场景的建模与优化方法研究（请替换）', tags: ['博士', '学位论文'], group: '',
      content: {
        degreeType: '工学博士',
        major: '计算机科学与技术',
        dates: '2022.09 – 2026.06',
        school: '示例大学',
        college: '计算机学院',
        advisor: '（待补充）',
        brief: '示例简要内容：围绕 XX 领域的数据建模与算法优化开展博士学位论文研究（请替换为你的论文内容）。',
        works: ['示例主要工作一：……（请替换）', '示例主要工作二：……（请替换）'],
      },
    },

    /* ---------- 核心技能 ---------- */
    {
      id: 'blk-skill-01', type: 'skill', title: '编程与工具', tags: ['Python', '工具'], group: '',
      content: { text: '编程与工具：Python / PyTorch / SQL；数据处理、分析与可视化。' },
    },
    {
      id: 'blk-skill-02', type: 'skill', title: '建模与算法', tags: ['机器学习', '算法'], group: '',
      content: { text: '建模与算法：机器学习与深度学习建模、时间序列分析、数值模拟。' },
    },
    {
      id: 'blk-skill-03', type: 'skill', title: '工程与协作', tags: ['项目', '协作'], group: '',
      content: { text: '工程与协作：项目申报与执行、跨团队沟通协作、文档与汇报材料撰写。' },
    },
    {
      id: 'blk-skill-04', type: 'skill', title: '语言与写作', tags: ['写作', '英语'], group: '',
      content: { text: '语言与写作：中英文文献阅读与梳理、科技论文写作（示例）。' },
    },

    /* ---------- 科研项目 ---------- */
    {
      id: 'blk-proj-01', type: 'project',
      title: '示例科研项目：城市数据智能分析平台关键技术研究（请替换）',
      tags: ['示例', '数据分析'], group: '',
      content: {
        source: '示例市科技局',
        projType: '政府委托项目',
        funding: '100万',
        work: '',
        works: [
          '项目概况：搭建示例数据平台，完成数据采集、清洗与建模（请替换）。',
          '算法研发：负责示例算法模块的设计与实现，并完成效果验证（请替换）。',
        ],
      },
    },
    {
      id: 'blk-proj-02', type: 'project',
      title: '示例横向项目：设备检测算法优化（请替换）',
      tags: ['示例', '横向项目'], group: '',
      content: {
        source: '示例科技有限公司',
        projType: '横向项目',
        funding: '',
        work: '',
        works: [
          '基于示例方法完成检测算法的优化与验证，形成可复用的算法流程（请替换）。',
        ],
      },
    },

    /* ---------- 实习经历 ---------- */
    {
      id: 'blk-intern-01', type: 'internship', title: '', tags: ['示例', '实习'], group: '',
      content: {
        company: '示例科技有限公司', position: '算法实习生', department: '数据智能部',
        location: '北京', start: '2025-06', end: '2025-09',
        works: [
          '数据处理：参与业务数据清洗与特征构建，形成可复用的数据处理流程（请替换）。',
          '模型验证：协助完成算法实验、效果分析与技术文档整理（请替换为实际工作和成果）。',
        ],
      },
    },

    /* ---------- 获奖经历 ---------- */
    {
      id: 'blk-award-01', type: 'award', title: '示例大学研究生学业奖学金（请替换）',
      tags: ['示例', '奖学金'], group: '',
      content: {
        level: '校级', rank: '一等奖', date: '2025.10', organization: '示例大学', recipient: '个人',
        desc: '示例获奖说明：因学业与科研表现获得奖励（请替换为实际奖项和获奖情况）。',
      },
    },

    /* ---------- 期刊论文 ---------- */
    {
      id: 'blk-paper-01', type: 'paper',
      title: '示例期刊论文一：面向 XX 的建模方法研究（请替换）',
      tags: ['第一作者'], group: '第一作者',
      content: { note: '', journal: '《示例期刊》', date: '2024.06', volume: '12(3): 1-10', desc: '示例简介：……（请替换）' },
    },
    {
      id: 'blk-paper-02', type: 'paper',
      title: '示例期刊论文二：XX 数据分析方法（请替换）',
      tags: ['第一作者'], group: '第一作者',
      content: { note: '', journal: '《示例期刊》', date: '2023.09', volume: '10(2): 20-30', desc: '示例简介：……（请替换）' },
    },
    {
      id: 'blk-paper-03', type: 'paper',
      title: '示例论文三：……（请替换）',
      tags: ['核心参与'], group: '其他核心参与论文',
      content: { note: '（第二作者）', journal: '《示例期刊》', date: '2023.03', volume: '9(1): 5-15', desc: '示例简介：……（请替换）' },
    },

    /* ---------- 专利 ---------- */
    {
      id: 'blk-pat-01', type: 'patent', title: '示例发明专利一：一种 XX 方法及系统（请替换）', tags: ['第二发明人'], group: '第二发明人',
      content: { status: '已授权，授权公告号：CN000000000A' },
    },
    {
      id: 'blk-pat-02', type: 'patent', title: '示例发明专利二：……（请替换）', tags: ['第三发明人'], group: '第三发明人',
      content: { status: '已公开，公开号：CN000000000A' },
    },
  ],

  variants: [
    {
      id: 'var-demo-a', name: '示例版本 · 算法岗',
      company: '示例科技有限公司',
      position: '算法工程师',
      intent: '算法工程师（机器学习方向）',
      themeId: 'theme-navy',
      summaryOverride: '', created: '2026-10-01', updated: '2026-10-01',
      sections: [
        { id: 'sec-edu', title: '教育背景', kind: 'education', items: [{ bid: 'blk-edu-phd', ov: {}, advisorIds: ['blk-advisor-phd'] }, { bid: 'blk-edu-bs', ov: {} }] },
        { id: 'sec-summary', title: '个人总结', kind: 'paragraph', items: [{ bid: 'blk-summary-01', ov: {} }] },
        { id: 'sec-skill', title: '核心技能', kind: 'bullets', items: [{ bid: 'blk-skill-01', ov: {} }, { bid: 'blk-skill-02', ov: {} }, { bid: 'blk-skill-03', ov: {} }, { bid: 'blk-skill-04', ov: {} }] },
        { id: 'sec-internships', title: '实习经历', kind: 'internships', items: [{ bid: 'blk-intern-01', ov: {} }] },
        { id: 'sec-awards', title: '获奖经历', kind: 'awards', items: [{ bid: 'blk-award-01', ov: {} }] },
        { id: 'sec-projects', title: '项目经历', kind: 'projects', items: [{ bid: 'blk-proj-01', ov: {} }, { bid: 'blk-proj-02', ov: {} }] },
        { id: 'sec-papers', title: '期刊论文', kind: 'publications', items: [{ bid: 'blk-paper-01', ov: {} }, { bid: 'blk-paper-02', ov: {} }, { bid: 'blk-paper-03', ov: {} }] },
        { id: 'sec-patents', title: '专利成果', kind: 'patents', items: [{ bid: 'blk-pat-01', ov: {} }, { bid: 'blk-pat-02', ov: {} }] },
      ],
    },
    {
      id: 'var-demo-b', name: '示例版本 · 数据岗',
      company: '示例研究院',
      position: '数据分析师',
      intent: '数据分析师',
      themeId: 'theme-modern',
      summaryOverride: '示例大学计算机科学与技术博士，具备机器学习与数据分析背景；熟悉 Python / PyTorch / SQL，参与多项科研与企业合作项目。（示例文本，请替换）',
      created: '2026-09-28', updated: '2026-10-01',
      sections: [
        { id: 'sec-edu', title: '教育背景', kind: 'education', items: [{ bid: 'blk-edu-phd', ov: {} }, { bid: 'blk-edu-bs', ov: {} }] },
        { id: 'sec-advisor', title: '研究生导师', kind: 'advisors', items: [{ bid: 'blk-advisor-phd', ov: {} }] },
        { id: 'sec-summary', title: '个人总结', kind: 'paragraph', items: [{ bid: 'blk-summary-01', ov: {} }] },
        { id: 'sec-projects', title: '主要项目', kind: 'projects', items: [{ bid: 'blk-proj-01', ov: {} }, { bid: 'blk-proj-02', ov: {} }] },
        { id: 'sec-papers', title: '论文成果', kind: 'publications', items: [{ bid: 'blk-paper-01', ov: {} }, { bid: 'blk-paper-02', ov: {} }, { bid: 'blk-paper-03', ov: {} }] },
        { id: 'sec-patents', title: '专利成果', kind: 'patents', items: [{ bid: 'blk-pat-01', ov: {} }, { bid: 'blk-pat-02', ov: {} }] },
      ],
    },
  ],

  applications: [
    {
      id: 'app-demo-a', company: '示例科技有限公司',
      position: '算法工程师',
      versionId: 'var-demo-a', status: '已投递', updated: '2026-10-01', notes: '',
      statusAt: { '准备中': '2026-09-28', '已投递': '2026-10-01' },
      jd: '（示例岗位 JD：可粘贴目标岗位描述，便于对照定制。）',
    },
    {
      id: 'app-demo-b', company: '示例研究院',
      position: '数据分析师',
      versionId: 'var-demo-b', status: '准备中', updated: '2026-09-28', notes: '',
      statusAt: { '准备中': '2026-09-28' },
      jd: '',
    },
  ],

  snapshots: [],

  /* 个人材料（简历以外的证件/证明文件，文件存于 assets/materials/） */
  materials: [],

  settings: { theme: 'navy', page: 'A4', app: 'moduleResume', version: '0.2.0' },
};

module.exports = { SEED, PHOTO_B64 };
