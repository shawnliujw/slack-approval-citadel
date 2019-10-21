FROM node:12.12-alpine
MAINTAINER Shanw Liu <shawn.jw.liu@gmail.com>
WORKDIR /app

COPY package.json  ./
RUN yarn install

FROM node:12.12-alpine
MAINTAINER Shanw Liu <shawn.jw.liu@gmail.com>
WORKDIR /app
ENV TZ=Asia/Shanghai
COPY --from=0 /app/node_modules /app/node_modules
#ADD src/app.js approval.js slack.js ./
ADD src/ ./src/
ADD package.json .
EXPOSE 7001
CMD yarn start

