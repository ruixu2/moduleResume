# moduleResume 🧩

**模块化简历工作台**：JavaScript（Node.js）编写 · 本地运行 · 支持 AI 提取简历 · 可打包 EXE · 浏览器直接使用。

一份素材库（素材块库），无限岗位版本——针对不同公司、不同岗位快速组装定制简历。

软件窗口左上角显示当前运行版本号，版本号由项目配置自动读取。

## 许可证

本项目采用 [Apache License 2.0](LICENSE)，允许使用、修改、分发和商业使用。分发本项目或包含其代码的衍生作品时，请遵守许可证要求，保留适用的版权和许可声明，并在许可证规定的位置保留 [NOTICE](NOTICE) 中的项目来源署名；修改过的文件须注明修改。第三方组件和素材仍遵守各自的许可证。

`NOTICE` 中的署名示例：`This product includes code from moduleResume (https://github.com/ruixu2/moduleResume).` Apache 2.0 的署名要求适用于协议规定的分发情形，协议全文以英文版 [LICENSE](LICENSE) 为准。旧版本可能使用不同许可证，请以相应版本所附许可证为准。

## 快速开始

**方式一：本地运行（开发/使用，建议 Node.js 22.13+）**

```bash
npm install                # 安装开发与文件解析依赖，并准备 PDF / Word 读取组件
node run.js                # 启动后自动打开浏览器 http://127.0.0.1:8787
node run.js --port 9000    # 指定端口
node run.js --no-browser   # 不自动开浏览器
```

或双击 `run_dev.bat`。

**方式二：打包为 EXE（免 Node 环境，使用 @yao-pkg/pkg）**

```bash
node scripts/build_exe.js   # 产物：dist\moduleResume.exe（首次会自动装打包器）
```

或双击 `build_exe.bat`。打包后的 EXE 双击即用：自动开浏览器，数据保存在 EXE 同级的 `data/` 目录（便携式，可整体拷到 U 盘）。

**方式三：桌面软件版（Electron，独立窗口，无浏览器界面）**

```bash
node scripts/build_desktop.js   # 产物：dist-desktop\moduleResume\moduleResume.exe
```

双击 `moduleResume.exe` 打开的是**独立软件窗口**（无地址栏 / 标签页）。首次会自动经 npmmirror 安装 Electron 运行时；`data/` 默认通过目录联接与项目 `data/` 共用。修改代码后需重新运行该脚本才会反映到软件版。

开发时也可双击项目中的 `run_desktop_dev.bat`，直接用当前源码启动桌面窗口，并使用项目内的 `data/`；首次使用前请先运行 `npm install`。

**方式四：Windows 安装包（推荐分发给他人，electron-builder + NSIS）**

```bash
node scripts/build_installer.js   # 产物：dist-installer\moduleResume-Setup-<版本>.exe
```

双击安装包走标准安装向导：可选安装目录、创建桌面与开始菜单快捷方式、可从「应用和功能」卸载。

- **不含个人信息**：打包内容只有 `backend/` `frontend/` `desktop/` 与 `package.json`，`data/` 目录被显式排除；构建脚本末尾还会扫描一次产物，一旦命中 `data/` 中的手机号、邮箱、姓名或证件照字节就**中止构建并删除产物**。
- **首次启动**：在 `%APPDATA%\moduleResume\data` 下用内置的通用示例数据（张三 / 示例大学…）初始化，用户自行替换，无需写程序目录（避开 Program Files 无写权限问题）。
- **升级与卸载**：卸载会删除程序文件和快捷方式，但保留 `%APPDATA%\moduleResume\data`，重装后简历数据仍在。

> 安装版未做代码签名，Windows SmartScreen 首次运行可能提示「未知发布者」，点「更多信息 → 仍要运行」即可。

### GitHub Actions 自动构建

推送到 `main` 分支时，GitHub Actions 会自动构建 Windows x64 网页版单文件 EXE 和桌面安装包；也可以在仓库的 **Actions → Build Windows EXE → Run workflow** 手动启动。构建成功后，在对应运行记录的 **Artifacts** 中下载 `moduleResume-browser-windows-x64` 或 `moduleResume-installer-windows-x64`，产物保留 30 天。安装包未经代码签名。

推送版本标签时还会自动创建 GitHub Release，将两个 EXE 作为附件发布，并自动生成更新说明。标签必须与 `package.json` 的版本一致；例如版本为 `0.2.9` 时：

```bash
git tag v0.2.9
git push origin v0.2.9
```

带预发布标识的版本（例如 `0.3.0-beta.1`）会标记为预发布。普通分支推送和手动构建不会创建 Release；同名 Release 已存在时发布步骤会失败，不会覆盖已有附件。

## 核心概念

| 概念 | 说明 |
|---|---|
| **个人项目**（projects） | 顶层工作区：每位求职者一个项目，数据完全独立；顶部菜单可切换 / 新建 / 重命名 / 删除 |
| **素材块库**（blocks） | 唯一事实来源。教育/技能/项目/论文/专利等全部拆成独立素材块，改一处所有引用版本同步生效 |
| **期刊论文** | 维护期刊名称、分区和影响因子等信息，支持版本级定制以及预览和导出；分区与影响因子可注明体系和年份 |
| **未发表论文** | 在素材块库中单独维护稿件题目、作者、稿件状态、拟投/投稿期刊和研究简介；可加入简历的“未发表论文”板块，与期刊论文分开显示 |
| **实习经历**（internship） | 独立维护公司、部门、岗位、地点、起止年月和多条工作与成果，支持自动保存、版本级定制及 HTML / Markdown / PDF 导出；结束时间留空表示至今 |
| **学习课程**（course） | 独立维护课程名称、开课单位、课程类型、学习时间、学分 / 学时、成绩和课程内容与收获；支持批量粘贴多门课程、自动保存、版本级定制及简历板块组装、预览和导出；简历中每门课程按单行显示 |
| **学术兼职**（academic_service） | 独立维护学术组织或期刊、职务、起止年月和职责成果，支持自动保存、版本级定制及简历预览和导出；结束时间留空表示至今 |
| **技能**（skill） | 每个技能可维护概览和多个子项，用于说明具体工具、方法、熟练程度或应用场景；支持自动保存、版本级定制及 HTML / Markdown / PDF 导出 |
| **获奖经历**（award） | 独立维护奖项名称、获奖级别、奖项等级、时间、颁奖单位、获奖身份或排名及个人贡献，支持自动保存、版本级定制及预览导出 |
| **研究生导师**（advisor） | 导师姓名、培养关系、职称职务、单位、研究方向等独立维护；可按简历版本嵌入指定学历，也可作为独立板块展示 |
| **简历版本**（variants） | 针对某公司/岗位的组装结果：从块库挑选素材、排序，支持「总结覆盖」「版本级定制（ov）」与自定义板块 |
| **论文类型切换** | 期刊论文、会议论文和未发表论文可在素材编辑器中随时互相切换，已填写内容保留；分别用于期刊论文、会议论文和未发表论文板块 |
| **版本分类** | 可为简历版本填写自定义分类，并在版本列表中按分类筛选；留空或旧版本显示为“未分类” |
| **版本快照**（snapshots） | 投递时冻结的版本副本（素材 + 排版 + 照片），之后改块库不影响「发出去的那一版」 |
| **个人材料**（materials） | 简历以外的证件与证明（身份证、学位证、证书、成果证明等，图片/PDF），按类别管理，用于满足不同岗位的投递要求 |
| **投递记录**（applications） | 公司 × 岗位 × JD × 状态（6 阶段进度条，点击节点更新），关联到具体简历版本与快照 |
| **排版主题**（themes） | 每版可独立选择：藏青学术 / 现代简约 / 学术红 / 经典黑白 / 宋体典雅 / 藏蓝横条 / **自定义样式**（主色、正文色、字体、字号、行距、章节样式、页面留白、照片位置与大小、版式密度均可调；编辑器工具条「🎨 样式定制」直达）（在 `backend/themes.js` 中扩展） |

“个人材料”页面可直接拖入一个或多个文件新建材料，也可点击拖放区选择文件。名称默认取文件名，类别沿用当前筛选（未筛选时为“其他”）；支持 JPG、PNG、WebP、GIF 和 PDF，单个文件最多 50MB。上传后可编辑名称、类别和备注，失败文件会逐项显示原因。

材料卡片上的“重命名”可直接修改名称，支持回车保存；下载时使用新名称并保留文件扩展名。

「学习课程」支持批量输入：在素材块库点击 **「批量添加课程」**，每行一门，字段用 `|`、`｜` 或制表符分隔。顺序为：课程名称、开课单位、课程类型、学习时间、学分/学时、成绩、课程内容与收获；只有课程名称必填。表头行、空行和以 `#` 开头的注释行会自动忽略，单次最多添加 200 门。

### AI 提取已有简历

1. 切换到目标个人项目，点击顶部 **「✨ AI 提取简历」**。选择 PDF、DOCX、TXT 或 Markdown（最大 10 MB），也可以直接粘贴简历文字。文件在本机转为文字；扫描版 PDF 需要先做 OCR。
2. 检查文字并删除不想发送的信息，填写支持 Chat Completions 的模型 API 地址、模型名和 API Key。界面默认填写 DeepSeek 示例，也可改为其他兼容服务或本机服务；本机服务可不填 Key。远程地址须使用 HTTPS。
3. 确认发送目标后开始提取。检查、修改和勾选需要导入的基础信息及素材；已有基础信息默认不覆盖。可同时创建一个包含所选素材的简历版本。

只有确认发送后才向所选模型服务提交文本和提取指令；模型服务可能处理个人信息并产生费用。API Key 不保存到项目数据中，提取结果必须确认后才写入。服务和模型的识别质量可能不同，建议逐项核对。

### 定制项目主要工作

打开一个简历版本，在项目条目右侧点击 **「定制」**，勾选要在当前简历显示的主要工作，也可逐条修改、添加、删除或调整顺序。未勾选的条目会保留在定制窗口中，之后可重新勾选；素材块库中的原文及其他版本不受影响。需要全部恢复时点击「清除定制」。

编辑简历时，可点击 **「＋ 从基础信息导入」** 从已有证件照中选择，或点击 **「＋ 上传本机图片」** 添加新照片；右侧简历预览没有照片时，点击照片位置也会打开同样的选择窗口。选中的照片只用于当前版本，也可改为跟随基础信息默认照片；如果当前自定义样式设置为“不显示照片”，选择后会切换为右上显示。

顶部 **「🔄 重启软件」** 会先保存当前编辑，再重启软件：桌面版重新打开应用窗口，网页版 / 单文件 EXE 重启本地服务并自动重连刷新。适用于更新代码后加载最新版本或恢复异常状态。

## 技术栈

- **后端**：Node.js（`node:http` 手写路由），含渲染引擎（blocks+variant → HTML/Markdown）和可选模型接口
- **前端**：原生 JS + CSS；PDF 和 DOCX 的本地文字读取分别使用 PDF.js 和 Mammoth 浏览器组件，`npm install` 时准备到静态资源目录
- **存储**：分块 JSON 文件（可 git、可网盘、可手工编辑）
- **打包**：@yao-pkg/pkg（单文件 EXE，内嵌 Node 运行时与前端资源）
- `legacy-python/`：最初的 Python（FastAPI）实现存档，供参考，功能与当前版本不完全一致

运行已有自动化测试：`npm test`。测试覆盖部分渲染、版本定制和 AI 提取导入流程，不代表全部功能均已覆盖。

## 目录结构

```
moduleResume/
├─ run.js               # 启动入口（开发与 EXE 通用）
├─ backend/             # Node.js 后端
│  ├─ index.js          #   HTTP 服务 + API + 渲染/导出路由 + 静态托管
│  ├─ render.js         #   渲染引擎：blocks+variants → HTML / Markdown（含版本级覆盖）
│  ├─ themes.js         #   排版主题包（藏青学术 / 现代简约）
│  ├─ storage.js        #   分块存储（每类信息一个 JSON 文件）
│  ├─ seed.js           #   初始数据（首次运行写入 data/）
│  └─ paths.js          #   开发/EXE 路径兼容（pkg 快照感知）
├─ frontend/            # 前端（零构建：原生 JS + CSS）
│  ├─ index.html / styles.css
│  ├─ app.js            #   核心：投递管理 / 版本列表 / 素材块库
│  └─ app-ui.js         #   编辑器 / 基础信息 / 导入导出
├─ data/                # 运行时数据（首次启动自动生成）
├─ desktop/             # 桌面软件版（Electron 主进程 + 图标）
├─ scripts/build_exe.js # pkg 打包脚本（网页/服务模式）
├─ scripts/build_desktop.js # 桌面软件版打包脚本（Electron 免安装）
├─ scripts/build_installer.js # Windows 安装包脚本（electron-builder + NSIS）
├─ package.json         # pkg 打包配置（assets/targets）
├─ run_dev.bat / build_exe.bat
└─ legacy-python/       # 早期 Python 实现（存档）
```

## 数据与备份

- 数据按「个人项目」隔离：`data/projects.json` 为项目注册表；`data/projects/<项目id>/` 下按模块分文件：`profile.json`、`blocks.json`、`variants.json`、`applications.json`、`snapshots.json`、`settings.json`、`assets/photo*`（旧版单项目布局启动时自动迁移为个人项目）
- 安装版的数据目录是 `%APPDATA%\moduleResume\data`（结构同上），不在安装目录内；网页版 / 便携版仍用程序目录的 `data/`。也可用环境变量 `MODULERESUME_DATA` 指定其它位置
- 导师绑定保存在版本的教育条目 `advisorIds` 中：同一导师素材可在不同版本中选择嵌入、不嵌入或放入独立的“研究生导师”板块。
- 在“素材块库 → 实习经历 → + 新增”录入实习素材。新建简历版本自带空的“实习经历”板块；已有版本可通过“添加板块”选择“实习经历”，再从块库添加素材。标题留空时自动显示公司与岗位。
- 在“素材块库 → 获奖经历 → + 新增”录入竞赛奖项、奖学金或荣誉。新建简历版本自带空的“获奖经历”板块；已有版本可通过“添加板块”选择“获奖经历”，再从块库添加素材。
- 文本 JSON 便于备份、对比和版本管理（可直接放进 git / 网盘）
- 界面右上角「导出数据 / 导入数据」仅处理当前项目的 JSON 数据，不包含其他项目或照片、个人材料文件，不能作为完整备份；完整备份请另行复制整个 `data/` 目录。

## API 速览（本地 http://127.0.0.1:8787）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET/POST | `/api/projects` | 个人项目列表 / 新建项目（新建后自动切换） |
| POST | `/api/projects/switch` | 切换当前项目（body：`{id}`） |
| PUT/DELETE | `/api/projects/{id}` | 重命名 / 删除项目（当前项目不可删除） |
| GET/PUT | `/api/{profile|blocks|variants|applications|snapshots|materials|settings}` | 分块读写（作用于当前项目） |
| POST / PUT / DELETE | `/api/materials`、`/api/materials/{id}` | 个人材料上传（图片/PDF，dataURL）/ 编辑信息 / 删除 |
| GET | `/assets/materials/{file}` | 材料文件访问 |
| GET/PUT | `/api/workspace` | 全部数据（导入导出用） |
| GET | `/api/themes` | 可用排版主题列表 |
| POST | `/api/ai/extract` | 将用户确认的简历文字发送至所选兼容模型，返回待核对结果 |
| POST | `/api/ai/import` | 将用户选择的提取结果合并至当前项目，可新建简历版本 |
| POST | `/api/snapshots` | 为版本创建快照（body：`{variantId}`） |
| DELETE | `/api/snapshots/{id}` | 删除快照 |
| POST | `/api/photo` | 上传证件照（dataURL） |
| POST | `/api/photos` | 向当前项目添加证件照，并用于指定简历版本 |
| GET | `/render/{variantId}?zoom=0.8&print=1` | 渲染预览页（zoom 缩放 / print 自动打印） |
| GET | `/render/snap/{snapshotId}` | 渲染冻结快照 |
| GET | `/api/export/{variantId}.md` | 导出 Markdown |
| GET | `/api/export/{variantId}.html` | 导出独立 HTML（照片内嵌） |
| GET | `/api/export/{variantId}.pdf` | **直接导出 PDF**（无头浏览器生成，无打印对话框） |
| GET | `/api/export/snap/{snapshotId}.md|.html` | 从快照导出 |

## 开发计划

开发计划在本地维护，不纳入仓库。
