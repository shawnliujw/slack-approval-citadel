const { WebClient } = require('@slack/web-api');
const { createMessageAdapter } = require('@slack/interactive-messages');
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
const slackInteractions = createMessageAdapter(slackSigningSecret);
const token = process.env.SLACK_TOKEN;
const SLACK_CHANNEL = process.env.SLACK_CHANNEL;
const web = new WebClient(token);
const Approval = require('./approval');
const moment = require('moment');
const dateFormat = 'YYYY-MM-DD HH:mm:ss';

const nowString = () => {
  return moment().format(dateFormat);
};
// const params = {
//     namespace: 'kezhaozhao/es-search', //CI_PROJECT_NAMESPACE
//     environment: 'Dev', //CI_ENVIRONMENT_NAME
//     project: 'es-search-service', //CI_PROJECT_NAME
//     projectURL: 'xxxxxx', // CI_PROJECT_URL
//     pipelineId: '5293', // $CI_PIPELINE_ID
//     branch: 'develop', // CI_COMMIT_REF_NAME
//     author: 'Liu Jianwei', // GITLAB_USER_NAME
//     commitTitle: 'debug flagger webhook gates', // CI_COMMIT_TITLE
//     commitId: '7573e5f709c6231750a20601f0b3c1bc7231675f' // CI_COMMIT_SHA
// }
const sendApprovalMessage = async params => {
  const slack_message = {
    channel: SLACK_CHANNEL,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'New deployment approval.'
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Namespace:*\n${params.namespace}`
          },
          {
            type: 'mrkdwn',
            text: `*Project:*\n *<${params.projectURL}|${params.project}>*`
          },
          {
            type: 'mrkdwn',
            text: `*Branch:*\n <${params.projectURL}/tree/${params.branch}|${params.branch}>`
          },
          {
            type: 'mrkdwn',
            text: `*Environment:*\n ${params.environment}`
          },
          {
            type: 'mrkdwn',
            text: `*Pipeline:*\n*<${params.projectURL}/pipelines/${params.pipelineId}|${params.pipelineId}>*`
          },
          {
            type: 'mrkdwn',
            text: `*Last Commit:*\n* <${params.projectURL}/commit/${params.commitId}|${params.commitTitle}>*`
          },
          {
            type: 'mrkdwn',
            text: `*Applicant:*\n ${params.author}`
          },
          {
            type: 'mrkdwn',
            text: `*When:*\n ${nowString()}`
          }
        ]
      }
    ]
  };
  const slack_message_confirm = {
    channel: SLACK_CHANNEL,
    text: `Would you like to promote the build to ${params.environment}?`,
    attachments: [
      {
        text: `Yes to deploy your build to ${params.environment}`,
        fallback: 'You are unable to promote a build',
        callback_id: `${params.approvalId}`,
        color: '#3AA3E3',
        attachment_type: 'default',
        actions: [
          {
            name: 'deployment',
            text: 'Yes',
            style: 'danger',
            type: 'button',
            value: 'yes',
            confirm: {
              title: 'Are you sure?',
              text: `This will deploy the build to ${params.environment}`,
              ok_text: 'Yes',
              dismiss_text: 'No'
            }
          },
          {
            name: 'deployment',
            text: 'No',
            type: 'button',
            value: 'no'
          }
        ]
      }
    ]
  };
  const result = await web.chat.postMessage(slack_message);
  slack_message_confirm.thread_ts = result.ts;
  const result1 = await web.chat.postMessage(slack_message_confirm);
  console.log(`Successfully send message ${result.ts} in conversation ${slack_message.channel}`);
  console.log(`Successfully send message ${result1.ts} in conversation ${slack_message.channel}`);
};

// const wrappedRespond = respond => {
//   let respondAlready = false;
//   const timeout = setTimeout(() => {
//     clearTimeout(timeout);
//     if(!respondAlready) {
//       respond({
//         text: `Your action not been respond in 3 seconds.`,
//         link_names: true,
//         replace_original: false,
//         ephemeral: true
//       });
//     }
//   }, 2500);
//   return function(body) {
//     respondAlready = true;
//     respond(body);
//   };
// };

const handleApprovalRes = () => {
  slackInteractions.action({ type: 'button' }, async (payload, respond) => {
    let invalidInteractive = false;
    let approvalId;
    try {
      approvalId = payload.callback_id;
      if (!approvalId) {
        invalidInteractive = true;
        throw new Error('approvalId is required, format is project_pipelineId');
      }
      const approval = await Approval.fetch(approvalId);
      if (!approval) {
        invalidInteractive = true;
        throw new Error(`approvalId(${approvalId}) is expired.`);
      }
      let approvalStatus = await approval.getStatus(payload.user.id, true);
      if (approvalStatus.message) {
        respond({
          text: approvalStatus.message,
          link_names: true,
          replace_original: false,
          ephemeral: true
        });
      }
      if (approvalStatus.messageThread) {
        respond({ text: `${payload.original_message.text}\n ~${approvalStatus.messageThread}~`, markdown: true, replace_original: true });
      }
      if (approvalStatus.approved || approvalStatus.rejected || approvalStatus.operated) {
        return;
      }

      const resBtnValue = payload.actions[0].value;

      const operationRes =
        resBtnValue === 'yes' ? await approval.approve(payload.user.id, payload.user.name) : await approval.reject(payload.user.id, payload.user.name);
      if (operationRes.success) {
        await web.chat.postMessage({
          channel: SLACK_CHANNEL,
          link_names: true,
          text: operationRes.message,
          thread_ts: payload.message_ts
        });
      } else {
        respond({
          text: operationRes.message,
          link_names: true,
          replace_original: false,
          ephemeral: true
        });
      }

      const approvalStatusAfter = await approval.getStatus(payload.user.id);
      if (approvalStatusAfter.approved || approvalStatusAfter.rejected) {
        respond({ text: `${payload.original_message.text}\n ~${approvalStatusAfter.messageThread}~`, markdown: true, replace_original: true });
      }
      console.log('Action proceed.');
    } catch (e) {
      console.error(e);
      if (invalidInteractive) {
        const message = `This application(${approvalId}) is invalid or  expired already.`;
        respond({ text: `${payload.original_message.text}\n ~${message}~`, markdown: true, replace_original: true });
      } else {
        respond({
          text: `<@${payload.user.id}> the approval interaction button occurred error: ${e.message}, please try again later.`,
          replace_original: false,
          link_names: true,
          ephemeral: true
        });
      }
    }
  });
  return slackInteractions.requestListener();
};

module.exports = {
  sendApprovalMessage,
  handleApprovalRes
};
