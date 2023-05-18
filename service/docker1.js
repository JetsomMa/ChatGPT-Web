const { execSync } = require('child_process')
const colors = require('colors-console')

const packageJsonConfig = require('./package.json')
const dockerHub = '118.195.236.91:5000'

console.error(colors('blue', `生产环境：准备生成镜像${packageJsonConfig.version}`))
console.error(colors('blue', '开始编译项目'))
runCmd('pnpm build')
console.error(colors('blue', '开始打包镜像'))
runCmd(`docker build --platform=linux/amd64 -f .chatgpt3/server1/Dockerfile -t ${dockerHub}/chatgpt-web-service1:${packageJsonConfig.version} .`)
console.error(colors('blue', '开始上传镜像'))
runCmd(`docker push ${dockerHub}/chatgpt-web-service1:${packageJsonConfig.version}`)
console.error(colors('blue', '镜像上传完毕！！！'))
console.error(colors('blue', '请执行以下命令启动镜像'))
console.error(colors('blue', `docker pull 127.0.0.1:5000/chatgpt-web-service1:${packageJsonConfig.version}`))

// 不用注册用户的服务版本
// console.error(colors('blue', `docker run --net=host --name chatgpt-web-service1 -d -v /etc/localtime:/etc/localtime:ro -v /home/jetsom/nginx/html/download/images/dalle:/var/images/dalle --env PORT=13002 --env HTTPS_PROXY=http://127.0.0.1:15777 --env DATASET_MYSQL_USER=dataset --env DATASET_MYSQL_PASSWORD=dataset2023 --env DATASET_MYSQL_DATABASE=dataset --env SOCKS_PROXY_HOST=127.0.0.1 --env SOCKS_PROXY_PORT=15778 --env OPENAI_API_KEY=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 127.0.0.1:5000/chatgpt-web-service1:${packageJsonConfig.version}`))
// 注册用户的服务版本
console.error(colors('blue', `docker run --net=host --name chatgpt-web-service12 -d -v /etc/localtime:/etc/localtime:ro -v /home/jetsom/nginx/html/download/images/dalle:/var/images/dalle --env PORT=13002 --env AUTH_SECRET_KEY=true --env HTTPS_PROXY=http://127.0.0.1:15777 --env DATASET_MYSQL_USER=dataset --env DATASET_MYSQL_PASSWORD=dataset2023 --env DATASET_MYSQL_DATABASE=dataset --env SOCKS_PROXY_HOST=127.0.0.1 --env SOCKS_PROXY_PORT=15778 --env OPENAI_API_KEY=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 127.0.0.1:5000/chatgpt-web-service1:${packageJsonConfig.version}`))

// 临时切换至https://openai-sb.com/版本
// 不用注册用户的服务版本
// console.error(colors('blue', `docker run --net=host --name chatgpt-web-service111 -d -v /etc/localtime:/etc/localtime:ro -v /home/jetsom/nginx/html/download/images/dalle:/var/images/dalle --env PORT=13002 --env OPENAI_API_BASE_URL=https://api.openai-sb.com --env DATASET_MYSQL_USER=dataset --env DATASET_MYSQL_PASSWORD=dataset2023 --env DATASET_MYSQL_DATABASE=dataset --env OPENAI_API_KEY=sb-43a5250685481889af42da078d9b9ca65befefa5012a9458 127.0.0.1:5000/chatgpt-web-service1:${packageJsonConfig.version}`))
// 注册用户的服务版本
// console.error(colors('blue', `docker run --net=host --name chatgpt-web-service112 -d -v /etc/localtime:/etc/localtime:ro -v /home/jetsom/nginx/html/download/images/dalle:/var/images/dalle --env PORT=13002 --env AUTH_SECRET_KEY=true --env OPENAI_API_BASE_URL=https://api.openai-sb.com --env DATASET_MYSQL_USER=dataset --env DATASET_MYSQL_PASSWORD=dataset2023 --env DATASET_MYSQL_DATABASE=dataset --env OPENAI_API_KEY=sb-43a5250685481889af42da078d9b9ca65befefa5012a9458 127.0.0.1:5000/chatgpt-web-service1:${packageJsonConfig.version}`))

function runCmd(cmd) {
  execSync(cmd, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
    if (error) {
      console.error(colors('red', `执行命令[${cmd}]发生异常`))
    }
    else {
      console.error(colors('yellow', `${stderr}`))
      console.error(colors('blue', `${stdout}`))
    }
  })
}
