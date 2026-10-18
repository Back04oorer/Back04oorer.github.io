# 小游戏页面

当前无需密码，打开 `/private/` 即可玩「合成头像」，主页页脚入口为 **Play**。页面结构在 `private/index.html`，`assets/private.js` 初始化游戏，不读取旧版加密内容。

页面已移除信息/操作面板（分数、最高纪录、下一张预览、暂停/重开按钮、玩法说明）和头像进化图鉴，游戏区域居中。保留键盘及触控操作，Esc 可暂停，暂停或结束浮层可继续/再来一局。

## 照片头像

当前使用五张真实照片外观的透明抠图：短发、波点帽、侧颜、猫耳帽、偏分短发。素材在 `assets/avatars/photo/`，保留完整 PNG，游戏加载等比例缩放、加透明留边的 512px 无损 WebP。

发布只提交当前使用的 WebP；完整 PNG、历史风格素材和原照片保留在本地备份中。

按用户确认，保留完整可见头部（脸、所有可见头发、帽子），移除手、衣服和背景。侧颜使用保留所有可见头部的参考区域；原片顶部未拍到的部分不补画。图片不做圆形裁剪，不绘制外圈、圆底、圆形等级角标或头像旁的等级数字。旧手绘与 Q 版保留备份，当前不再使用。

## 轮廓碰撞

碰撞、合成接触、墙壁/地板和满线判定都使用照片透明轮廓生成的复合多边形，不再使用圆形范围。渲染与碰撞共享同一缩放和旋转，透明留边不占碰撞空间；长发下方的凹口保留。为保证稳定运行，半透明碎发、微小孤立发丝和小孔洞会简化，因此是轮廓近似而非逐像素碰撞。

`assets/avatar-colliders.mjs` 是由当前 WebP alpha 生成的静态数据。换素材后，运行 `node scripts/build-avatar-colliders.mjs` 重建（构建时需安装 `sharp`；`poly-decomp` 已附于 `scripts/vendor/`）。浏览器使用本地打包的 Matter.js 0.20.0，许可证见 `assets/vendor/matter-LICENSE.txt`，无需运行时 CDN。

原图在本地 `.private/avatar-originals/`，提示词和完整 PNG 保存在本地备份，本次只发布实际使用的 WebP。

游戏逻辑在 `assets/melon-engine.mjs`，渲染和操作在 `assets/melon-game.mjs`，样式在 `assets/melon-game.css`。物理和计分规则沿用原版，动漫头像最高分使用独立浏览器存储键。刷新会重新开始当前对局。

预览：`python3 -m http.server 8000 --bind 127.0.0.1`，打开 `http://localhost:8000/private/`。

检查：`node --test scripts/melon.test.mjs`。

旧版加密内容与密码保留在 `.private/`、`private/content.json` 及相关脚本中，当前页面不使用它们。发布时提交 `private/index.html` 和引用的游戏资源，无需重新加密；不提交 `.private/`。
