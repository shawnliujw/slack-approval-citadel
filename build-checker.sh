#!/usr/bin/env bash
rm checker/package.json
cp package.json ./checker
cd ./checker
docker build -t registry.cn-shanghai.aliyuncs.com/shawn_repo/slack-approval-checker .
docker tag registry.cn-shanghai.aliyuncs.com/shawn_repo/slack-approval-checker:latest registry.cn-shanghai.aliyuncs.com/shawn_repo/slack-approval-checker:2.2
docker push registry.cn-shanghai.aliyuncs.com/shawn_repo/slack-approval-checker:2.2

#docker run -it registry.cn-shanghai.aliyuncs.com/shawn_repo/slack-approval-checker sh
