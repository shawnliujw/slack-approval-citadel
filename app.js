const Redis = require("ioredis");
Redis.Promise = require("bluebird");
const slackHandler = require('./slack');
const express = require('express');
const bodyParser = require('body-parser');
const PORT = process.env.PORT || 7001
const Approval = require('./approval');
// Create an express application
const app = express();


// 必须要放在 bodyParser之前
app.use('/approval/callback', slackHandler.handleApprovalRes())
// Example of handling static select (a type of block action)

app.get('/approval/ping', (req,res)=> {
    res.send(`pong at: ${new Date()}`);
})
app.use(bodyParser());

// const body = {
//     namespace: 'kezhaozhao/es-search', //CI_PROJECT_NAME
//     environment: 'Dev', //CI_ENVIRONMENT_NAME
//     project: 'es-search-service', //CI_PROJECT_NAMESPACE
//     projectURL: 'xxxx', // CI_PROJECT_URL
//     pipelineId: '5293', // $CI_PIPELINE_ID
//     branch: 'develop', // CI_COMMIT_REF_NAME
//     author: 'Liu Jianwei', // GITLAB_USER_NAME
//     commitTitle: 'debug flagger webhook gates', // CI_COMMIT_TITLE
//     commitId: '7573e5f709c6231750a20601f0b3c1bc7231675f' // CI_COMMIT_SHA
// }
app.post('/approval', async (req,res) => {
    const body = req.body;
    const cacheKey = `${body.project}_${body.pipelineId}`;
    await Approval.getCache(cacheKey,true,body.approvals ? parseInt(body.approvals) : 0);
    body.approvalId  = cacheKey;
    await slackHandler.sendApprovalMessage(body);
    res.json({
        success: true
    });
})

app.use('/approval/gate', async (req,res) => {
    try {
        const body = req.query;
        const cachekey = `${body.project}_${body.pipelineId}`;
        console.log(`Fetching approval status: ${cachekey}`);
        const cached = await Approval.getCache(cachekey);
        if(!cached) {
            res.json({
                message: [`Approval '${cachekey}' doesn't exist`],
                nonExist: true
            });
        } else {
            const messageList = [];
            const r = await cached.getResult();
            res.json(r);
        }
    } catch (e) {
        console.error(e);
        res.status(500).send(e.message);
    }

})


const redis = new Redis({
    port: process.env.REDIS_PORT || 6379, // Redis port
    host: process.env.REDIS_HOST || "127.0.0.1", // Redis host
    password: process.env.REDIS_PASSWD || "",
    db: process.env.REDIS_DB || 0,
    keyPrefix: 'job_approval_'
});
global.redis = redis;
redis.on('error', err => {
    console.log('REDIS: FAILED');
    console.error(err);
    process.exit(0)
})
redis.on('connect', () => {
    app.listen(PORT,async () => {
        console.log(`Listening server on port: ${PORT}`);
    });
})

