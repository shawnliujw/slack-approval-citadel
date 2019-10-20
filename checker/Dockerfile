FROM registry.cn-shanghai.aliyuncs.com/shawn_repo/kubectl-node:13-12
MAINTAINER Shanw Liu <shawn.jw.liu@gmail.com>
WORKDIR /app

COPY package.json  ./
RUN yarn install

FROM node:12.12-alpine
MAINTAINER Shanw Liu <shawn.jw.liu@gmail.com>
WORKDIR /app



COPY --from=0 /app/node_modules /app/node_modules
ADD check.js ./
ADD package.json .
