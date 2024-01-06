const { Cluster } = require('puppeteer-cluster');
const randUserAgent = require('rand-user-agent');
const csv = require('csv-parser');
const fs = require('fs');
const readline = require('readline');

const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    cyan: "\x1b[36m"
};



function delay(time) {
    return new Promise(function (resolve) {
        setTimeout(resolve, time);
    });
}

async function getDomainRank({ page, data: { keyword, domain } }) {
    const userAgent = randUserAgent("desktop");
    await page.setUserAgent(userAgent);

    await page.setViewport({ width: 1920, height: 1080 });
    let found = false;
    let overallRank = 0;

    for (let pageIdx = 1; pageIdx <= 20 && !found; pageIdx++) {
        const pageUrl = `https://93soeqt3ef.execute-api.ap-southeast-3.amazonaws.com/xx?q=${encodeURIComponent(keyword)}&start=${(pageIdx - 1) * 10}`;
        await page.goto(pageUrl, { waitUntil: 'networkidle2' });
        await page.waitForSelector('.tF2Cxc', { timeout: 5000 });

        const rankPosition = await page.evaluate((domain) => {
            const results = document.querySelectorAll('.tF2Cxc');
            for (let i = 0; i < results.length; i++) {
                const urlElement = results[i].querySelector('a');
                if (urlElement && urlElement.href.includes(domain)) {
                    return i + 1;
                }
            }
            return -1;
        }, domain);

        if (rankPosition !== -1) {
            overallRank = (pageIdx - 1) * 10 + rankPosition;
            console.log(`${colors.green}[${domain}] KW: "${keyword}" [Page: ${pageIdx} | Pos ${rankPosition} ] | AllRank ${overallRank}${colors.reset}`);
            const [linkHandle] = await page.$x(`(//div[contains(@class, 'tF2Cxc')])[${rankPosition}]//a`);

            if (linkHandle) {
                await linkHandle.click();
                found = true;
                await delay(10000); // Wait for 30 seconds after clicking the link
            } else {
                console.log(`${colors.red}Could not find clickable link for ${domain} at position ${overallRank}.${colors.reset}`);
            }
        }
    }

    if (!found) {
        console.log(`${colors.red}${domain} not found in the first 20 pages of search results for the keyword "${keyword}".${colors.reset}`);
    }
}

async function processCsvFile(filePath, maxConcurrency) {
    const cluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_CONTEXT,
        maxConcurrency: maxConcurrency,
        monitor: false,
        puppeteerOptions: { headless: false, args: ['--no-sandbox'] }
    });

    let isFirstRow = true;  // Flag to check if it's the first row

    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                if (isFirstRow) {
                    console.log(`${colors.cyan}Queueing keywords and domains from file ${filePath}${colors.reset}`);
                    isFirstRow = false;  // Reset the flag after the first row
                }
                cluster.queue({ keyword: row.keyword, domain: row.domain }, getDomainRank);
            })
            .on('end', async () => {
                console.log(`${colors.yellow}CSV file successfully processed${colors.reset}`);
                await cluster.idle();
                await cluster.close();
                resolve(); // Resolve the promise when the cluster closes
            })
            .on('error', (error) => {
                console.error(`${colors.red}Error processing CSV file:${colors.reset}`, error);
                reject(error); // Reject the promise in case of an error
            });
    });
}

// Function to prompt for user input
function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }))
}

async function main() {
    try {
        console.log(`[!] ${colors.red}Please note! the success of the process is depend on useragent used!!${colors.reset}`);
        console.log(`[!] ${colors.red}Please note! the success of the process is depend on useragent used!!${colors.reset}`);
        console.log(`[!] ${colors.red}Please note! the success of the process is depend on useragent used!!${colors.reset}`);
        await delay(2000);
        const filePath = await askQuestion("Enter the data filename: ");
        const maxConcurrency = parseInt(await askQuestion("Enter max concurrency for each session: "), 10);
        const sessions = parseInt(await askQuestion("How many sessions will be run: "), 10);

        for (let i = 0; i < sessions; i++) {
            console.log(`${colors.yellow}Starting session ${i + 1}/${sessions}${colors.reset}`);
            await processCsvFile(filePath, maxConcurrency); // Wait for the browser to close
            console.log(`${colors.yellow}Session ${i + 1} completed.${colors.reset}`);
        }

        console.log(`${colors.green}All sessions completed.${colors.reset}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
}

main();
