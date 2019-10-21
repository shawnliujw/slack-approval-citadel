# Slack Approval Citadel
This project is the bridge between [Slack Approval Guard](https://github.com/shawnliujw/slack-approval-guard/blob/master/README.md) and [Slack](https://slack.com) , it will respond the request from both of them.

[Click Here](https://github.com/shawnliujw/slack-approval-guard/blob/master/README.md#workflow) to get more screenshots to see how it works.

## Workflow  
1. receive *Approval Process* request from [Slack Approval Guard](https://github.com/shawnliujw/slack-approval-guard/blob/master/README.md)
2. send message to the specific slack group
3. listen the interactive actions from slack and response the latest status to [Slack Approval Guard](https://github.com/shawnliujw/slack-approval-guard/blob/master/README.md)

## How to use  
* Setup slack workspace and create an App for this integration
* run `yarn start` and get public domain , if you run from your localhost, you can try [localhost.sh](https://localhost.run/) or [ngrok](https://ngrok.com/) 
* after Slack App setup, please find the token, secret, channel(receive approval message) and configure them by these env variable  before you start your project  
```yaml
SLACK_SIGNING_SECRET=xxx
SLACK_SIGNING_TOKEN=xxx
SLACK_CHANNEL=xxxx
```
* then can use it together with [Slack Approval Guard](https://github.com/shawnliujw/slack-approval-guard/blob/master/README.md)


## API List
* `POST /approval/registry`  register the approval process  
```js
const params = {
    namespace: 'xxx', //CI_PROJECT_NAME
    environment: 'Dev', //CI_ENVIRONMENT_NAME
    project: 'xxx', //CI_PROJECT_NAMESPACE
    projectURL: 'xxxxxx', // CI_PROJECT_URL
    pipelineId: '5293', // $CI_PIPELINE_ID
    branch: 'develop', // CI_COMMIT_REF_NAME
    author: 'xxx', // GITLAB_USER_NAME
    commitTitle: 'debug flagger webhook gates', // CI_COMMIT_TITLE
    commitId: '7573e5f709c6231750a20601f0b3c1bc7231675f' // CI_COMMIT_SHA
}
```
* `GET /approval/gate?project=xxx&pipeline=xxx`  check the approval result  
* configure `<domain>/approval/callabck` to your slack app interactive callback  


