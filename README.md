# slack-approval
CI/CD  approval with slack

## how to use  
1. `yarn start`  
2. use api `POST /approval` to registry the approval process  
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
