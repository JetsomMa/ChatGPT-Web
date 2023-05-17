const { execSync } = require('child_process')
const colors = require('colors-console')

const packageJsonConfig = require('./package.json')
const dockerHub = '118.195.236.91:5000'

console.error(colors('blue', `生产环境：准备生成镜像${packageJsonConfig.version}`))
console.error(colors('blue', '开始编译项目'))
runCmd('pnpm build')
console.error(colors('blue', '开始打包镜像'))
runCmd(`docker build --platform=linux/amd64 -f .chatgpt3/server-test/Dockerfile -t ${dockerHub}/chatgpt-web-service-test:${packageJsonConfig.version} .`)
console.error(colors('blue', '开始上传镜像'))
runCmd(`docker push ${dockerHub}/chatgpt-web-service-test:${packageJsonConfig.version}`)
console.error(colors('blue', '镜像上传完毕！！！'))
console.error(colors('blue', '请执行以下命令启动镜像'))
console.error(colors('blue', `docker pull 127.0.0.1:5000/chatgpt-web-service-test:${packageJsonConfig.version}`))

// 不用注册用户的服务版本
console.error(colors('blue', `docker run --net=host --name chatgpt-web-service-test -d --volume /etc/localtime:/etc/localtime:ro --env PORT=33002 --env HTTPS_PROXY=http://127.0.0.1:15777 --env DATASET_MYSQL_USER=dataset --env DATASET_MYSQL_PASSWORD=dataset2023 --env DATASET_MYSQL_DATABASE=dataset --env SOCKS_PROXY_HOST=127.0.0.1 --env SOCKS_PROXY_PORT=15778 --env OPENAI_API_KEY=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 127.0.0.1:5000/chatgpt-web-service-test:${packageJsonConfig.version}`))
// 注册用户的服务版本
// console.error(colors('blue', `docker run --net=host --name chatgpt-web-service-test2 -d --volume /etc/localtime:/etc/localtime:ro --env PORT=33002 --env AUTH_SECRET_KEY=true --env HTTPS_PROXY=http://127.0.0.1:15777 --env DATASET_MYSQL_USER=dataset --env DATASET_MYSQL_PASSWORD=dataset2023 --env DATASET_MYSQL_DATABASE=dataset --env SOCKS_PROXY_HOST=127.0.0.1 --env SOCKS_PROXY_PORT=15778 --env OPENAI_API_KEY=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 127.0.0.1:5000/chatgpt-web-service-test:${packageJsonConfig.version}`))

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
