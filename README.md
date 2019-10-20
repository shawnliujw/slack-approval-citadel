# slack-approval
CI/CD  approval with slack

## how to use  
1. `yarn start`  
2. use api `POST /approval/registry` to register the approval process  
```js
const params = {
    namespace: 'kezhaozhao/es-search', //CI_PROJECT_NAME
    environment: 'Dev', //CI_ENVIRONMENT_NAME
    project: 'es-search-service', //CI_PROJECT_NAMESPACE
    projectURL: 'xxxxxx', // CI_PROJECT_URL
    pipelineId: '5293', // $CI_PIPELINE_ID
    branch: 'develop', // CI_COMMIT_REF_NAME
    author: 'Liu Jianwei', // GITLAB_USER_NAME
    commitTitle: 'debug flagger webhook gates', // CI_COMMIT_TITLE
    commitId: '7573e5f709c6231750a20601f0b3c1bc7231675f' // CI_COMMIT_SHA
}
```
3. use api `GET /approval/gate?project=xxx&pipeline=xxx` to check the approval result  
4. configure `<domain>/approval/callabck` to your slack app interactive callback  

## use with gitlab ci  
1. deploy the `slack-approval` and get domain , like `http://slack.example.com`  
2. use the check in your gitlab-ci:  
* Now the slack-approval-checker image integrate kubectl already
```yaml
deploy_prod:
  image: registry.cn-shanghai.aliyuncs.com/shawn_repo/slack-approval-checker
  stage: sample
  script:
    - node check.js setup $CI_PROJECT_NAMESPACE -n $CI_PROJECT_NAMESPACE -e $CI_ENVIRONMENT_NAME -p $CI_PROJECT_URL -p $CI_PIPELINE_ID -b $CI_COMMIT_REF_NAME -a $GITLAB_USER_NAME -c $CI_COMMIT_TITLE -C $CI_COMMIT_SHA -s 'http://slack.example.com/approval'
    - if [ $N -ne 0 ];  then exit ; fi
    - [your other scripts]
```
