# subcvt-mannix

订阅转换后端 api 反向代理

转为 clash 订阅的专属功能：

- 移除无节点的分组
- 移除错误 uuid 的节点
- 确保 h2 / grpc 的 tls 为 true
- 对 grpc-service-name 进行 URL 解码
- 节点 type 和 cipher 筛选（使用完全匹配的正则表达式）：
  - `type=ssr?|vmess|trojan` 匹配 ss / ssr / vmess / trojan 节点
  - `type!=hysteria2?` 排除 hysteria / hysteria2 节点
  - `type!=vless|hysteria2?` 排除 vless / hysteria / hysteria2  节点
  - `cipher=...`
  - `cipher!=...`
- 支持修改 sni/servername/Host/host：
  - `sni={域名}` 修改所有节点的 sni/servername/Host/host
  - `sni=d` 删除所有节点的 sni/servername/Host/host
  - `sni={sni1}|{sni2}|{sni3}` 依次设置为 sni1 sni2 sni3 sni1...
  - `sni={server1}@{sni1},{server2}@{sni2}|{sni3}|d,{sni4}` 不同 server 设置不同 sni（server 使用部分匹配的正则表达式）
- 支持修改 server：
  - `server={域名/ip}` 修改所有节点的 server
  - `server={server1}|{server2}|{server3}` 依次设置为 server1 server2 server3 server1...
  - `server={sni1}@{server1},{sni2}@{server2}|{server3},{server4}` 不同 sni 设置不同 server（sni 使用部分匹配的正则表达式）
- 支持修改自动组策略：
  - `gtype=url-test` ⚡ ‍低延迟，优先选择低延迟节点
  - `gtype=fallback` ✔️ ‍自动切换，选择第一个能用的节点
  - `gtype=load-balance` ⚖️ ‍负载均衡，按域名哈希选择节点，同域请求分配给同一节点
  - `gtype=round-robin` 🔃 ‍循环，每次请求按顺序选择下一个能用的节点，到最后再回到第一个节点循环往复
  - `gtype=sticky-sessions` 🥂 ‍黏性会话，10 分钟内同域请求分配给同一节点
  - `strategy=...` `gtype` 别名
  - `testurl=...` 延迟/可用性测试链接
  - `testinterval=...` 测试的间隔时间（秒）
  - `tolerance=...` `url-test` 的节点切换容差（毫秒），当前节点和最低延迟节点相差超过该值时将触发切换
- 支持修改 up/down:
  - `up=30` 修改 hysteria / hysteria2 的 up 参数为 30（Mbps）
  - `up=0` 删除 hysteria2 的 up 参数（转为 BBR 拥塞控制算法）
  - `down=200` 修改 hysteria / hysteria2 的 down 参数为 200（Mbps）
  - `down=0` 删除 hysteria2 的 down 参数（转为 BBR 拥塞控制算法）

默认 /sub 路径，默认转为 clash 订阅

- `https://sc.mnnx.cc/?url={原订阅链接}`（随机后端 + 默认配置 + 默认参数）
- `https://sc.mnnx.cc/api.v1.mk?url={原订阅链接}`（指定后端）
- `https://sc.mnnx.cc/version`（指定路径）
- `https://sc.mnnx.cc/api.v1.mk/version`（指定后端和路径）

url 参数快捷方式

- `https://sc.mnnx.cc/{原订阅链接}`
- `https://sc.mnnx.cc/{后端地址}/{原订阅链接}`（原订阅链接需 URL 编码）
- ~~`https://sc.mnnx.cc/?{原订阅链接}`~~（原订阅链接无需 URL 编码，但如果存在 # 字符则必须编码，否则会被截断）
- ~~`https://sc.mnnx.cc?config={远程配置}&{原订阅链接}`~~（同上）

github raw url 快捷方式

`https://sc.mnnx.cc/r/{owner}/{repo}/{ref}/{path}` -> `https://sc.mnnx.cc/?url=https://raw.githubusercontent.com/{owner}/{repo}/{ref}/{path}`

其他用法与 https://github.com/tindy2013/subconverter/blob/master/README-cn.md 相同，如：

- `https://sc.mnnx.cc/?config={远程配置}&url={原订阅链接}`（指定配置）
- `https://sc.mnnx.cc/?target=mixed&url={原订阅链接}`（指定目标类型）
