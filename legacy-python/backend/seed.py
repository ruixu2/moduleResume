"""moduleResume · 初始数据（仅首次运行时写入 data/ 目录，之后不会覆盖用户修改）

⚠ 本文件为早期 Python 实现存档，全部为「通用示例数据」，不含任何真实个人信息。

数据结构说明：
    blocks     素材块库（唯一事实来源）；type 取值：
               summary | education | skill | project | paper | patent | custom
    variants   岗位定制版本：sections[].items[] 通过 bid 引用素材块，ov 做版本级覆盖
    applications 投递记录
"""

# 默认不内置证件照；可在「基础信息」页上传
PHOTO_B64 = ""

SEED = {
    "profile": {
        "name": "张三",
        "birth": "2000年1月",
        "hometown": "示例市",
        "phone": "13800000000",
        "email": "zhangsan@example.com",
        "photo": "assets/photo.jpg",
    },

    "blocks": [
        # ---------- 个人总结 ----------
        {
            "id": "blk-summary-01",
            "type": "summary",
            "title": "个人总结（示例）",
            "tags": ["示例"],
            "group": "",
            "content": {
                "text": "示例大学计算机科学与技术博士（硕博连读），研究方向为机器学习与数据建模。"
                        "参与国家/省级科研课题及企业合作项目，负责算法开发与数据分析。"
                        "（请替换为你的真实总结）"
            },
        },

        # ---------- 教育背景 ----------
        {
            "id": "blk-edu-phd",
            "type": "education",
            "title": "博士 · 示例大学 计算机学院",
            "tags": ["博士", "计算机"],
            "group": "",
            "content": {
                "dates": "2022.09 – 2026.06",
                "school": "示例大学 · 计算机学院",
                "degree": "计算机科学与技术 / 博士（硕博连读）",
            },
        },
        {
            "id": "blk-edu-bs",
            "type": "education",
            "title": "本科 · 示例大学 信息学院",
            "tags": ["本科", "计算机"],
            "group": "",
            "content": {
                "dates": "2018.09 – 2022.06",
                "school": "示例大学 · 信息学院",
                "degree": "计算机科学与技术（本科）",
            },
        },

        # ---------- 核心技能 ----------
        {
            "id": "blk-skill-01",
            "type": "skill",
            "title": "编程与工具",
            "tags": ["Python", "工具"],
            "group": "",
            "content": {"text": "编程与工具：Python / PyTorch / SQL；数据处理、分析与可视化。"},
        },
        {
            "id": "blk-skill-02",
            "type": "skill",
            "title": "建模与算法",
            "tags": ["机器学习", "算法"],
            "group": "",
            "content": {"text": "建模与算法：机器学习与深度学习建模、时间序列分析、数值模拟。"},
        },

        # ---------- 科研项目 ----------
        {
            "id": "blk-proj-01",
            "type": "project",
            "title": "示例科研项目：城市数据智能分析平台关键技术研究（请替换）",
            "tags": ["示例", "数据分析"],
            "group": "",
            "content": {
                "work": "",
                "bullets": [
                    "项目概况：搭建示例数据平台，完成数据采集、清洗与建模（请替换）。",
                    "算法研发：负责示例算法模块的设计与实现，并完成效果验证（请替换）。",
                ],
            },
        },
        {
            "id": "blk-proj-02",
            "type": "project",
            "title": "示例横向项目：设备检测算法优化（请替换）",
            "tags": ["示例", "横向项目"],
            "group": "",
            "content": {
                "work": "",
                "bullets": [
                    "基于示例方法完成检测算法的优化与验证，形成可复用的算法流程（请替换）。",
                ],
            },
        },

        # ---------- 期刊论文 ----------
        {
            "id": "blk-paper-01",
            "type": "paper",
            "title": "示例期刊论文一：面向 XX 的建模方法研究（请替换）",
            "tags": ["第一作者"],
            "group": "第一作者",
            "content": {"note": "", "desc": "示例简介：……（请替换）"},
        },
        {
            "id": "blk-paper-02",
            "type": "paper",
            "title": "示例期刊论文二：XX 数据分析方法（请替换）",
            "tags": ["第一作者"],
            "group": "第一作者",
            "content": {"note": "", "desc": "示例简介：……（请替换）"},
        },

        # ---------- 专利 ----------
        {
            "id": "blk-pat-01",
            "type": "patent",
            "title": "示例发明专利一：一种 XX 方法及系统（请替换）",
            "tags": ["第二发明人"],
            "group": "第二发明人",
            "content": {"status": "已授权，授权公告号：CN000000000A"},
        },
    ],

    "variants": [
        {
            "id": "var-demo-a",
            "name": "示例版本",
            "company": "示例科技有限公司",
            "position": "算法工程师",
            "intent": "算法工程师（机器学习方向）",
            "summaryOverride": "",
            "created": "2026-10-01",
            "updated": "2026-10-01",
            "sections": [
                {"id": "sec-edu", "title": "教育背景", "kind": "education",
                 "items": [{"bid": "blk-edu-phd", "ov": {}}, {"bid": "blk-edu-bs", "ov": {}}]},
                {"id": "sec-summary", "title": "个人总结", "kind": "paragraph",
                 "items": [{"bid": "blk-summary-01", "ov": {}}]},
                {"id": "sec-skill", "title": "核心技能", "kind": "bullets",
                 "items": [{"bid": "blk-skill-01", "ov": {}}, {"bid": "blk-skill-02", "ov": {}}]},
                {"id": "sec-projects", "title": "项目经历", "kind": "projects",
                 "items": [{"bid": "blk-proj-01", "ov": {}}, {"bid": "blk-proj-02", "ov": {}}]},
                {"id": "sec-papers", "title": "期刊论文", "kind": "publications",
                 "items": [{"bid": "blk-paper-01", "ov": {}}, {"bid": "blk-paper-02", "ov": {}}]},
                {"id": "sec-patents", "title": "专利成果", "kind": "patents",
                 "items": [{"bid": "blk-pat-01", "ov": {}}]},
            ],
        },
    ],

    "applications": [
        {
            "id": "app-demo-a",
            "company": "示例科技有限公司",
            "position": "算法工程师",
            "versionId": "var-demo-a",
            "status": "准备中",
            "updated": "2026-10-01",
            "notes": "",
            "jd": "（示例岗位 JD：可粘贴目标岗位描述，便于对照定制。）",
        },
    ],

    "settings": {
        "theme": "navy",
        "page": "A4",
        "app": "moduleResume",
        "version": "0.1.0",
    },
}
