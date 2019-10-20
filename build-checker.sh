#!/usr/bin/env bash
rm checker/package.json
cp package.json ./checker
docker build -t registry.cn-shanghai.aliyuncs.com/shawn_repo/slack-approval-checker .
#docker push registry.cn-shanghai.aliyuncs.com/shawn_repo/slack-approval-checker
