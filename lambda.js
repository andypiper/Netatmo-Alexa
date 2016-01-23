// http://stackoverflow.com/questions/33859826/linking-netatmo-weather-station-to-amazon-echo-alexa

/**
*   Author: Dr. Mihai GALOS
*   Timestamp: 17:17:00, November 1st 2015
*
*/

var http = require('https');
var https = require('https');
var querystring = require('querystring');

var clientId = ''; // create an application at https://dev.netatmo.com/ and fill in the generated clientId here
var clientSecret = ''; // fill in the client secret for the application
var userId= ''; // your registration email address
var pass = ''; // your account password

// Route the incoming request based on type (LaunchRequest, IntentRequest,
// etc.) The JSON body of the request is provided in the event parameter.
exports.handler = function (event, context) {
    try {
        console.log("event.session.application.applicationId=" + event.session.application.applicationId);

        /**
         * Uncomment this if statement and populate with your skill's application ID to
         * prevent someone else from configuring a skill that sends requests to this function.
         */

        // if (event.session.application.applicationId !== "amzn1.echo-sdk-ams.app.your-unique-id") {
        //      context.fail("Invalid Application ID");
        //  }


        if (event.session.new) {
            onSessionStarted({requestId: event.request.requestId}, event.session);
        }

        if (event.request.type === "LaunchRequest") {
            onLaunch(event.request,
                     event.session,
                     function callback(sessionAttributes, speechletResponse) {
                        context.succeed(buildResponse(sessionAttributes, speechletResponse));
                     });
        }  else if (event.request.type === "IntentRequest") {
            onIntent(event.request,
                     event.session,
                     function callback(sessionAttributes, speechletResponse) {
                         context.succeed(buildResponse(sessionAttributes, speechletResponse));
                     });
        } else if (event.request.type === "SessionEndedRequest") {
            onSessionEnded(event.request, event.session);
            context.succeed();
        }
    } catch (e) {
        context.fail("Exception: " + e);
    }
};


function onSessionStarted(sessionStartedRequest, session) {
    console.log("onSessionStarted requestId=" + sessionStartedRequest.requestId +
            ", sessionId=" + session.sessionId);
}


function onLaunch(launchRequest, session, callback) {
    console.log("onLaunch requestId=" + launchRequest.requestId +
            ", sessionId=" + session.sessionId);

    // Dispatch to your skill's launch.

    getData(callback);

}


function onIntent(intentRequest, session, callback) {
    console.log("onIntent requestId=" + intentRequest.requestId +
            ", sessionId=" + session.sessionId);

    var intent = intentRequest.intent,
        intentName = intentRequest.intent.name;
    var intentSlots ;

    console.log("intentRequest: "+ intentRequest);
    if (typeof intentRequest.intent.slots !== 'undefined') {
        intentSlots = intentRequest.intent.slots;
    }


     getData(callback,intentName, intentSlots);


}


function onSessionEnded(sessionEndedRequest, session) {
    console.log("onSessionEnded requestId=" + sessionEndedRequest.requestId +
            ", sessionId=" + session.sessionId);
    // Add cleanup logic here
}

// --------------- Functions that control the skill's behavior -----------------------



function doCall(payload, options, onResponse,
                callback, intentName, intentSlots){

        var req = https.request(options, function(res) {
                res.setEncoding('utf8');

                 console.log("statusCode: ", res.statusCode);
                 console.log("headers: ", res.headers);


                res.on('data', function (chunk) {
                    console.log("body: " + chunk);
                    var parsedResponse = JSON.parse(chunk);
                    if (typeof onResponse !== 'undefined') {
                        onResponse(parsedResponse, callback, intentName, intentSlots);
                    }

                });

                res.on('error', function (chunk) {
                    console.log('Error: '+chunk);
                });

                res.on('end', function() {

                    //callback(sessionAttributes, buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
                });

            });

            req.on('error', function(e){console.log('error: '+e)});
            req.write(payload);

            req.end();

}

function getData(callback, intentName, intentSlots){

        console.log("sending request to netatmo...")

        var payload = querystring.stringify({
            'grant_type'    : 'password',
            'client_id'     : clientId,
            'client_secret' : clientSecret,
            'username'      : userId,
            'password'      : pass,
            'scope'         : 'read_station'
      });

        var options = {
            host: 'api.netatmo.com',
            path: '/oauth2/token',
            method: 'POST',
           headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(payload)
            }

        };

        console.log('making request with data: ',options);

        // get token and set callbackmethod to get measure
        doCall(payload, options, onReceivedTokenResponse, callback, intentName, intentSlots);
}

function onReceivedTokenResponse(parsedResponse, callback, intentName, intentSlots){

        var payload = querystring.stringify({
            'access_token'  : parsedResponse.access_token
      });

        var options = {
            host: 'api.netatmo.com',
            path: '/api/devicelist',
            method: 'POST',
           headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(payload)
            }

        };

    doCall(payload, options, getMeasure, callback, intentName, intentSlots);

}

function getMeasure(parsedResponse, callback, intentName, intentSlots){

    var data = {
                tempOut         : parsedResponse.body.modules[0].dashboard_data.Temperature,
                humOut          : parsedResponse.body.modules[0].dashboard_data.Humidity,
                rfStrengthOut   : parsedResponse.body.modules[0].rf_status,
                batteryOut      : parsedResponse.body.modules[0].battery_vp,

                tempIn      : parsedResponse.body.devices[0].dashboard_data.Temperature,
                humIn       : parsedResponse.body.devices[0].dashboard_data.Humidity,
                co2         : parsedResponse.body.devices[0].dashboard_data.CO2,
                press       : parsedResponse.body.devices[0].dashboard_data.Pressure,

                rainGauge           : parsedResponse.body.modules[1].dashboard_data,
                rainGaugeBattery    : parsedResponse.body.modules[1].battery_vp
               };

    var repromptText = null;
    var sessionAttributes = {};
    var shouldEndSession = true;
    var speechOutput ;

    if( "AskTemperature" === intentName)  {
        //console.log("Intent: AskTemperature, Slot:"+intentSlots.Location.value);

        if("indoors" ===intentSlots.Location.value){
            speechOutput = "It is "+data.tempIn+" degrees in the living room.";

        }
        else if ("defaultall" === intentSlots.Location.value){
            speechOutput = "It is "+data.tempIn+" degrees inside and "+data.tempOut+" outside.";
        }

      if(data.rainGauge.Rain > 0) speechOutput += "It is raining.";

    } else if ("AskRain" === intentName){
        speechOutput = "It is currently ";
        if(data.rainGauge.Rain > 0) speechOutput += "raining.";
        else speechOutput += "not raining. ";

        speechOutput += "Last hour it has rained "+data.rainGauge.sum_rain_1+" millimeters, "+data.rainGauge.sum_rain_1+" in total today.";

    } else { // AskTemperature
        speechOutput = "Ok. It is "+data.tempIn+" degrees inside and "+data.tempOut+" outside.";

        if(data.rainGauge.Rain > 0) speechOutput += "It is raining.";
    }

        callback(sessionAttributes,
             buildSpeechletResponse("", speechOutput, repromptText, shouldEndSession));

}

// --------------- Helpers that build all of the responses -----------------------

function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: "PlainText",
            text: output
        },
        card: {
            type: "Simple",
            title: "SessionSpeechlet - " + title,
            content: "SessionSpeechlet - " + output
        },
        reprompt: {
            outputSpeech: {
                type: "PlainText",
                text: repromptText
            }
        },
        shouldEndSession: shouldEndSession
    };
}

function buildResponse(sessionAttributes, speechletResponse) {
    return {
        version: "1.0",
        sessionAttributes: sessionAttributes,
        response: speechletResponse
    };
}
