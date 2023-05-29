# subcvt-mannix

订阅转换后端 api 反向代理 + 自动移除无节点的分组

默认 /sub 路径，默认转为 clash 订阅

- `https://u.fail/scm?url={原订阅链接}`（短链，不支持指定后端、路径）
- `https://scm.onrender.com?url={原订阅链接}`（随机后端 + 默认配置 + 默认参数）
- `https://scm.onrender.com/api.v1.mk?url={原订阅链接}`（指定后端）
- `https://scm.onrender.com/version`（指定路径）
- `https://scm.onrender.com/api.v1.mk/version`（指定后端和路径）

其他用法与 https://github.com/tindy2013/subconverter/blob/master/README-cn.md 相同，如：

- `https://scm.onrender.com?config={远程配置}&url={原订阅链接}`（指定配置）
- `https://scm.onrender.com?target=mixed&url={原订阅链接}`（指定目标类型）
