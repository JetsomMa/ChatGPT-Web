const { execSync } = require('child_process')
const colors = require('colors-console')

const version = '0.1.12'

console.error(colors('blue', `生产环境：准备生成镜像${version}`))
console.error(colors('blue', '开始打包镜像'))
runCmd(`docker build --platform=linux/amd64 -t 118.195.236.91:5000/chatgpt-web:${version} .`)
console.error(colors('blue', '开始上传镜像'))
runCmd(`docker push 118.195.236.91:5000/chatgpt-web:${version}`)
console.error(colors('blue', '镜像上传完毕！！！'))
console.error(colors('blue', '请执行以下命令启动镜像'))
console.error(colors('blue', `docker pull 127.0.0.1:5000/chatgpt-web:${version}`))
console.error(colors('blue', `docker run --net=host --name chatgpt-web -d --env HTTPS_PROXY=http://127.0.0.1:15777 --env OPENAI_API_KEY=sk-XXXX 127.0.0.1:5000/chatgpt-web:${version}`))

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
