const program = require('commander');
const Promise = require('bluebird');
const rp = require('request-promise');
const _ = require('lodash');
const chalk = require('chalk');


const register = async (projectName,options) => {
    try {
        const json = _.pick(options, ['namespace','environment','project','projectURL','pipelineId','branch','author','commitTitle','commitId', 'approvals']);
        json.project = projectName;
        console.log(chalk.green(`Registry approval process to: ${options.serverURL}/registry`))
        const response = await rp({
            method: 'POST',
            uri: `${options.serverURL}/registry`,
            body:json,
            json: true
        });
        console.log(chalk.green('Success to register, will check response...'));
    }catch (e) {
        console.log(e);
        throw new Error('failed to register approval process')
    }

}

const check = async (projectName,options) => {

    const res = await rp({
        uri: `${options.serverURL}/gate?project=${projectName}&&pipelineId=${options.pipelineId}`,
        json: true
    });
    // console.log(`${options.serverURL}/gate?project=${projectName}&&pipelineId=${options.pipelineId}`)
    // console.log(res);
    if(res.rejected) {
        res.message.forEach(msg => {
            console.log(chalk.red(msg));
        });
        process.exit(-1);
    } else if(res.approved) {
        res.message.forEach(msg => {
            console.log(chalk.green(msg));
        });
        process.exit(0)
    } else if (res.nonExist) {
        res.message.forEach(msg => {
            console.log(chalk.red(msg));
        });
        process.exit(-1)
    }else {
        res.message.forEach(msg => {
            console.log(chalk.yellow(msg));
        });
    }
}

program
    .version('1.0.0')
    .requiredOption('-n, --namespace <string>', 'namespace of the project')
    .requiredOption('-e, --environment <string>', 'deployment environment')
    .requiredOption('-P, --projectURL <string>', 'project URL')
    .requiredOption('-p, --pipelineId <string>', 'current pipeline ID')
    .requiredOption('-b, --branch <string>', 'the current branch')
    .requiredOption('-a, --author <string>', 'who trigger the pipeline')
    .requiredOption('-c, --commitTitle <string>', 'the last commit title')
    .requiredOption('-C, --commitId <string>', 'the last commit id')
    .requiredOption('-s, --serverURL <string>', 'the approval server URL')
    .option('-E, --expire <number>', 'expire time in second, default is 30 minutes', 1800)
    .option('-i, --interval <number>', 'the interval to check the result', 3)
    .option('-v, --approvals <number>', 'at least need  how many approvals, default is 1', 1)
    .option('-r, --retry <number>', 'retry times when error', 10)
program
    .command('setup <projectName>')
    .description('Init the approval process with required fields')
    .action(async function(projectName, parentCommand){
        try {
            const options = parentCommand.parent;


            await register(projectName,options);
            let errors = 0;

            console.log(chalk.green(`Ready to check approval status every ${options.interval} seconds, progress will expire in ${options.expire}`))
            for(let i=0;i<options.expire;i+= 3) {
                if(errors > options.retry) {
                    throw new Error(`errors reached the max times: ${options.retry}`);
                }
                try {
                    await check(projectName, options);
                } catch (e) {
                    console.log(chalk.red(e.message));
                    errors++;
                }
                await Promise.delay(options.interval * 1000);
            }
            console.log(chalk.red('Approval timeout....'));
            process.exit(-1);
        }catch (e) {
            console.log(chalk.red(e.message));
            process.exit(-1);
        }

    });


program.parse(process.argv);
