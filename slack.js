const { WebClient } = require('@slack/web-api');
const { createMessageAdapter } = require('@slack/interactive-messages');
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
const slackInteractions = createMessageAdapter(slackSigningSecret);
const token = process.env.SLACK_TOKEN;
const SLACK_CHANNEL = process.env.SLACK_CHANNEL;
const web = new WebClient(token);
const Approval = require('./approval');

// const params = {
//     namespace: 'kezhaozhao/es-search', //CI_PROJECT_NAME
//     environment: 'Dev', //CI_ENVIRONMENT_NAME
//     project: 'es-search-service', //CI_PROJECT_NAMESPACE
//     projectURL: 'xxxxxx', // CI_PROJECT_URL
//     pipelineId: '5293', // $CI_PIPELINE_ID
//     branch: 'develop', // CI_COMMIT_REF_NAME
//     author: 'Liu Jianwei', // GITLAB_USER_NAME
//     commitTitle: 'debug flagger webhook gates', // CI_COMMIT_TITLE
//     commitId: '7573e5f709c6231750a20601f0b3c1bc7231675f' // CI_COMMIT_SHA
// }
exports.sendApprovalMessage = async (params) => {
    const slack_message = {
        "channel": SLACK_CHANNEL,
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "New deployment approval."
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": `*Namespace:*\n${params.namespace}`
                    },
                    {
                        "type": "mrkdwn",
                        "text": `*Project:*\n *<${params.projectURL}|${params.project}>*`
                    },
                    {
                        "type": "mrkdwn",
                        "text": `*Branch:*\n <${params.projectURL}/tree/${params.branch}|${params.branch}>`
                    },
                    {
                        "type": "mrkdwn",
                        "text": `*Environment:*\n ${params.environment}`
                    },
                    {
                        "type": "mrkdwn",
                        "text": `*Pipeline:*\n*<${params.projectURL}/pipelines/${params.pipelineId}|${params.pipelineId}>*`
                    },
                    {
                        "type": "mrkdwn",
                        "text": `*Last Commit:*\n* <${params.projectURL}/commit/${params.commitId}|${params.commitTitle}>*`
                    },
                    {
                        "type": "mrkdwn",
                        "text": `*Applicant:*\n ${params.author}`
                    },
                    {
                        "type": "mrkdwn",
                        "text": `*When:*\n ${new Date().toISOString()}`
                    }
                ]
            },

        ],
    }
    const slack_message_confirm = {
        "channel": SLACK_CHANNEL,
        "text": `Would you like to promote the build to ${params.environment}?`,
        "attachments": [
            {
                "text": `Yes to deploy your build to ${params.environment}`,
                "fallback": "You are unable to promote a build",
                "callback_id": `${params.approvalId}`,
                "color": "#3AA3E3",
                "attachment_type": "default",
                "actions": [
                    {
                        "name": "deployment",
                        "text": "Yes",
                        "style": "danger",
                        "type": "button",
                        "value": 'yes',
                        "confirm": {
                            "title": "Are you sure?",
                            "text": `This will deploy the build to ${params.environment}`,
                            "ok_text": "Yes",
                            "dismiss_text": "No"
                        }
                    },
                    {
                        "name": "deployment",
                        "text": "No",
                        "type": "button",
                        "value": 'no'
                    }
                ]
            }
        ]
    }
    const result = await web.chat.postMessage(slack_message);
    slack_message_confirm.thread_ts = result.ts;
    const result1 = await web.chat.postMessage(slack_message_confirm);
    console.log(`Successfully send message ${result.ts} in conversation ${slack_message.channel}`);
    console.log(`Successfully send message ${result1.ts} in conversation ${slack_message.channel}`);
}

exports.handleApprovalRes = () => {

    slackInteractions.action({ type: 'button' }, async (payload, respond) => {
        // console.log(payload);
        let invalidInteractive = false;
        let confirmReplacedMessage = 'Approval has been terminated(approved or rejected), remove the submit buttons.'
        try {
            confirmReplacedMessage = `${payload.original_message.text}\n ~Approval has been terminated(approved or rejected)~`;
            const approvalId = payload.callback_id;
            if(!approvalId) {
                invalidInteractive = true;
                throw new Error('approvalId is required, format is project_pipelineId')
            }
            const cached = await Approval.getCache(approvalId);
            if(!cached) {
                invalidInteractive = true;
                throw new Error('approvalId is expired')
            }
            if(cached.isApproved()) {
                await web.chat.postMessage({
                    channel: SLACK_CHANNEL,
                    link_names: true,
                    text: `This approval has been approved, please do not submit repetitive`,
                    thread_ts: payload.message_ts
                });
                respond({text: confirmReplacedMessage, markdown: true, replace_original: true});
                return;
            }

            const resBtnValue = payload.actions[0].value;

            if(resBtnValue === 'yes') {
                await web.chat.postMessage({
                    channel: SLACK_CHANNEL,
                    link_names: true,
                    text: `<@${payload.user.id}>  approved the request at ${new Date()}`,
                    thread_ts: payload.message_ts
                });
                await cached.approve(`Approval is approved: User ${payload.user.name} approved the request at ${new Date()}, progress(${cached.approvedCount}/${cached.approvals})`);
                const approved = await cached.isApproved();
                if(approved) {
                    await web.chat.postMessage({
                        channel: SLACK_CHANNEL,
                        link_names: true,
                        text: `This approval has been approved。(all done)`,
                        thread_ts: payload.message_ts
                    });
                    respond({text: confirmReplacedMessage, markdown: true, replace_original: true});
                }

            } else {
                await cached.reject(`Approval is been rejected: ${payload.user.name} rejected the request at ${new Date()}`);
                await web.chat.postMessage({
                    channel: SLACK_CHANNEL,
                    link_names: true,
                    text: `<@${payload.user.id}>  rejected the request at ${new Date()}`,
                    thread_ts: payload.message_ts
                });
                respond({text: confirmReplacedMessage, markdown: true, replace_original: true});
            }
        }catch (e) {
            if(invalidInteractive) {
                await web.chat.postMessage({
                    channel: SLACK_CHANNEL,
                    link_names: true,
                    text: `This approval has expired.`,
                    thread_ts: payload.message_ts
                });
                respond({text: confirmReplacedMessage, markdown: true, replace_original: true});
            } else {
                await web.chat.postMessage({
                    channel: SLACK_CHANNEL,
                    link_names: true,
                    text: `<@${payload.user.id}> the approval interaction button occurred error: ${e.message}, please try again later.`,
                    thread_ts: payload.message_ts
                });
            }
        }
    });
    return slackInteractions.requestListener();
}
