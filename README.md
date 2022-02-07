# Gemini Price Deviation Alerting Service - POC <!-- omit in toc -->
NodeJS built HTTP server that retrieves one or more `X Gemini Exchange trading pair symbols`,
and calculates if any of the pairs's latest close price is greater than `Y standard deviations` 
from the average of its previous 24 hour close price average, where `X` and `Y` are user provided
inputs.  

Minimal dependency bloat, 3 in total
- https://github.com/simple-statistics/simple-statistics
- https://github.com/axios/axios
- https://github.com/follow-redirects/follow-redirects *(depended by axios)*

### Table of Contents <!-- omit in toc -->
- [Introduction](#introduction)
  - [Problem Statement](#problem-statement)
  - [Language Selection](#language-selection)
- [Setup](#setup)
  - [Prerequisites](#prerequisites)
  - [Up & Running](#up--running)
- [Usage](#usage)
  - [Usage Examples](#usage-examples)
  - [Clean Up](#clean-up)
- [Conclusion](#conclusion)

## Introduction
Hello all, my name is Rob, and I'm excited to be considered for this opportunity to work amongst
a group of elite engineers such as yourselves! ;-P

I know you are all very busy, so first - thanks for taking the time to review this.  
I will try to keep this short and to the point.

### Problem Statement
My task was to create a tool within 4 hours for the following scenario:

>For each of the symbols (ie. currency pairs) that Gemini trades you must generate an alert for 
the following condition:
>
> - Price Deviation - Generate an alert if the standard deviation from the hourly prices for 
> past 24 hours is more >than 1 (or any indicated value if there’s a CLI parameter defined in the tool)

Additionally, I was told that I could use any language of my choice, but that Python3 
or Golang were recommended *(in retrospect, I see why)*. 

### Language Selection
While I have frequent *(monthly)* experience creating python tools,
Ansible plugins, and web services.. NodeJS *(informally referring to ECMAScript 6 or TypeScript)* 
has been my daily language due to the codebases I have committed to over the course of my career.

Ultimately though, I view languages as just another tool to get the job done, and so I always aim
to pick the *best* tool for the job *(consideration to both the technical & business requirements)*. 
That said, I recognize while NodeJS excels at I/O operations, like web requests, it is not 
meant for CPU intensive operations, such as complex mathematical calculations, or really 
math in general. 

Since this was a time-constrained & graded assignment, I knew that Python or NodeJS were going to
be my personal best choices, as I don't yet have enough experience with Golang (or Rust) to feel
comfortable submitting it for grading. 

So originally my plan was to just use both Python and NodeJS...   
Using NodeJS as the HTTP server & *(Gemini API)* client, and Python/Numpy for the mathematical 
operations, as well as a Python CLI program that would speak to the NodeJS HTTP server for the
Gemini API results. My goal was to be able to show ability in both languages, while using each 
language to its strengths & weaknesses. 

In the end though, after two hours of getting a functional NodeJS POC working, I wasn't happy
with the quality of the code. So after comparing & feeling confident with the results between
Numpy and the simple-statistics JS library, I decided it would just be best to double down on 
the NodeJS approach and refactor it to improve its readability. 

## Setup
### Prerequisites
For best usage, the following prerequisites are recommended:
- Docker
- docker-compose
- curl
- jq

The code can also be ran locally with NodeJS v17.4.0.

### Up & Running
1. Clone this repo
    ```bash
    git clone https://github.com/sudosoul/gemini-deviation-alert.git gemini-deviation-alert
    cd !:3
    ```
2. Server by default runs on port 7777, you can change this value in the `.env` file.  
   Start server using Docker...
   ```bash
   docker-compose up
   ```
   Start server locally using NodeJS...
   ```bash
   node src/server.mjs
   ```

## Usage
Now that the server is running, it will be accessible to HTTP GET requests at `http://localhost:7777`,

It requires the following QueryString parameters:
1. deviation - {Number} Any positive whole or fractional Number - The deviation threshold.
2. tradingPairs - {string} - A comma separated list of 1 or more valid Gemini trading pairs (or 'all').

It returns a JSON array containing the following object model for each successful trading pair:
```
   {
     "timestamp": "2022-02-07T20:18:27.146Z",
     "level": "INFO",
     "trading_pair": "btcusd",
     "deviation": true,
     "data": {
       "last_price": "44329.1",
       "average": "42878.2868",
       "sdev": "1.7724",
       "change": "1450.8132"
     }
   }
```

The model for error responses is similar, and is:
```
  {
    "timestamp": "2022-02-07T20:30:40.477Z",
    "level": "ERROR",
    "trading_pair": "gusdusd",
    "data": {
      "result": "error",
      "reason": "upstream",
      "message": "Received unsupported symbol 'GUSDUSD'"
    }
  }
```

### Usage Examples
Here's some examples..

1. Get just one trading pair, `btcusd`, with deviation of `1`
     ```bash
     export D=1 \
     && export TP="btcusd" \
     && curl "http://localhost:7777/alerts?deviation=${D}&tradingPairs=${TP}" \
       | jq .
     ```
2. Get 3 trading pairs, `btcusd,ethbtc,ethusd`, with deviation of `1`
     ```bash
     export D=1 \
     && export TP="btcusd,ethbtc,ethusd" \
     && curl "http://localhost:7777/alerts?deviation=${D}&tradingPairs=${TP}" \
       | jq .
     ```
3. Get just the alerts, for 3 trading pairs, `btcusd,ethbtc,ethusd`, with deviation of `1`
     ```bash
     export D=1 \
     && export TP="btcusd,ethbtc,ethusd" \
     && curl "http://localhost:7777/alerts?deviation=${D}&tradingPairs=${TP}" \
       | jq '.[] | select(.deviation == true)'
     ```
4. Get just the alerts, for **all** trading pairs, with deviation of `2.2`
     ```bash
     export D=2.2 \
     && export TP="all" \
     && curl "http://localhost:7777/alerts?deviation=${D}&tradingPairs=${TP}" \
       | jq '.[] | select(.deviation == true)'
     ```
**Note:** We are limited to 10 requests per second by the Gemini API.

### Clean Up
Once done, gracefully SIGINT `CTRL-C` the docker-compose process, and clear the env vars 
```bash
unset D TP
```

## Conclusion
*(Short on time, forgive the briefness)*  

All in all, this was a very interesting challenge, and I learned from it. In total, I made sure to limit coding to under 4 hours, I spent an additional hour writing up the README, and I spent several hours a couple nights
before I started by casually researching from my phone at night market statistics, grpc, IDLs, messaging, 
and the formulas for standardDeviation, variance, etc.  

While the challenge itself may have seemed simple in its essence of "HTTP GET, do math, output results",
it was definitely an eye-opener in that I realized how important performance is going to be when needing
to monitor something with so much volatility, as well as being able to host it in a distributed way where it can work with services in other programming languages.  

As a result, I plan on further researching & practicing with
- Golang - although I slightly favor the syntax of Rust, I recognize that competent knowledge of Go will be required to contribute to and work alongside engineers at Gemini, so I plan on taking on a personal project ASAP.
- gRPC 3 / Apache Thrift / IDLs - I can see scenarios where various teams at Gemini perhaps have extensive data analysis libraries in Python or R/etc. As such, I think it will be important to know how to successfully integrate distributed services with each other, regardless of their programming language. 

**As far as further improvments**, I'm sure I could think endlessly on this subject.
At the very least, I would include tests for any production code. But I think tests are most valuable
when they are written *during* development, not after. When tests are written after development, most
of the time those tests will never fail because they are written around the existing code. Whereas
when tests are written during development, it results in cleaner, better organized, and more pure (SRP) code
with a better depth of coverage, as the code is written around the tests. 


If I was sticking with NodeJS, additionally I would use the `express` framework for the HTTP Server, and
potentially implement Worker Threads for increased performance. At that point though, I'd rather just write
it all in Go or Rust. 

The code itself `server.mjs` also has some comments with `TODO`s.

**As far as additional features**, I'm sure I could *also* think endlessly on this subject.  
But one thing I definitely did realize, is that no two trading pairs are the same. So I think there
are more factors (yet to be learned by me) that will have to go into understanding Market/Crypto volatility. 

Thanks again for your time. 
 