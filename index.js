/* eslint-disable  func-names */
/* eslint quote-props: ["error", "consistent"]*/
/**
 * Alexa My Life skill.
 **/

'use strict';

const Alexa = require('alexa-sdk');
const graph = require('fbgraph');
const moment = require('moment');

const APP_ID = undefined;  // TODO replace with your app ID (OPTIONAL).

const months = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

const days = ['1st', '2nd', '3rd'];

const languageStrings = {
    'en-US': {
        translation: {
            SKILL_NAME: 'My Life',
            DESCRIPTION : 'Welcome to my life, try saying ask my life to tell me about June 2011.',
            GET_FACT_MESSAGE: "Here's your fact: ",
            HELP_MESSAGE: 'You can say, tell me about ',
            HELP_REPROMPT: 'What can I help you with?',
            STOP_MESSAGE: 'Thank you for using My Life!',
        },
    },
};

const handlers = {
    'LaunchRequest': function () {
        this.emit(':tell', this.t('DESCRIPTION'));
    },
    'TellMeAbout': function () {
        var slotDate = this.event.request.intent.slots.date.value;

        var date = moment(slotDate);
        var dateUnix = date.unix();

        console.log('slotDate - ' + slotDate);
        console.log('date.unix() - ' + dateUnix);

        var dateEnd = moment.unix(dateUnix);
        var timePeriod = figureOutTimePeriod(slotDate);

        dateEnd.add(1, timePeriod);
        console.log(timePeriod);

        var untilTime = getRandomUntilTime(date, dateEnd);

        console.log('untilTime - ' + untilTime.unix());

        var me = graph.get("me/posts?until=" + untilTime.unix(), (req, res) => {
            var numberOfPosts = res.data.length;

            if (numberOfPosts == 0) {
                this.emit(':tell', "I could not find any information for that " + timePeriod);
            }
            else {
                var randomPost = Math.floor(Math.random() * numberOfPosts);

                var post = res.data[randomPost];

                var day = moment(post.created_time);
                var id = post.id;
                console.log('postId - ' + id);

                this.attributes.postId = id;

                var message = "On " + getFriendlyDate(untilTime);

                if (post.message) {
                    message = message + " you said " + post.message + ".";

                    if (post.story) {
                        message = message + post.story;
                    }
                }
                else if (post.story) {
                    message = message + post.story;
                }

                console.log('message - ' + message);

                summarizeLikes(id, (postSummary) => {
                    console.log('postSummary - ' + postSummary);

                    if (message.endsWith('.') || message.endsWith('!')) {
                        this.emit(':tell', message +  postSummary);
                    }
                    else {
                        this.emit(':tell', message + '.' + postSummary);
                    }

                });
            }
        });
    },
    'AMAZON.HelpIntent': function () {
        const speechOutput = this.t('HELP_MESSAGE');
        const reprompt = this.t('HELP_MESSAGE');
        this.emit(':ask', speechOutput, reprompt);
    },
    'AMAZON.CancelIntent': function () {
        this.emit(':tell', this.t('STOP_MESSAGE'));
    },
    'AMAZON.StopIntent': function () {
        this.emit(':tell', this.t('STOP_MESSAGE'));
    },
    'SessionEndedRequest': function () {
        this.emit(':tell', this.t('STOP_MESSAGE'));
    },
    'Unhandled': function() {
        this.emit(':ask', 'Sorry, I didn\'t get that. try saying tell me about June 2011.', 'try saying tell me about June 2011.');
    }
};

function getRandomUntilTime(startDate, endDate) {
    var startDateUnix = startDate.unix();
    var endDateUnix = endDate.unix();

    var difference = endDateUnix - startDateUnix;

    var random = Math.floor(Math.random() * difference);

    return moment.unix(startDateUnix + random);
}

/**
 * Figure out a friendly date based on the given momentjs date.
 *
 * @param momentDate
 * @returns {string}
 */
function getFriendlyDate(momentDate) {
    let day = momentDate.day() < days.length ? days[momentDate.day()] : momentDate.day() + 'th';
    let month = months[momentDate.month()];

    return month + ' ' + day + ' ' + momentDate.year();
}

/**
 * Figre out what did the user ask for.  A day?  A month? A year?
 *
 * @param slotDate
 * @returns {*}
 */
function figureOutTimePeriod(slotDate) {
    // Specific day. 2015-11-04
    if (slotDate.match(/\d{4}-\d{2}-\d{2}/)) {
        return 'day';
    }
    // Specific month.  2005-12
    else if (slotDate.match(/\d{4}-\d{2}/)) {
        return 'month';
    }
    // Specific week.  2005-W23
    else if (slotDate.match(/\d{4}-W\d{2}/)) {
        return 'week';
    }
    // Year.  2005
    else if (slotDate.match(/\d{4}/)) {
        return 'year';
    }
}

/**
 * Summarises comments for a specific postId.
 *
 * @param postId
 */
function summarizeComments(postId) {
    graph.get(postId + "/comments?summary=true", function(req, res) {
        var data = res.data;
        var commentCount = res.summary.total_count;


    });
}

/**
 * Summarizes likes for a specific postId.
 * @param postId
 */
function summarizeLikes(postId, callback) {
    var me = graph.get(postId + "/likes?summary=true", (req, res) => {
        var likeCount = res.summary.total_count;
        var hasLiked = res.summary.has_liked;
        /**
         * If any friends liked this post,
         * pick out the first few friends from the list.
         *
         * We don't need to list everybody that liked the post!
         */
        var friends = [];
        console.log(JSON.stringify(res.data));
        if (res.data.length > 0) {
            for (var count = 0; count < res.data.length; count++) {
                var friend = res.data[count];
                console.log(JSON.stringify(friend));

                friends.push(friend.name.split(' ')[0]);

                if (friends.length > 2) {
                    friends.push('and other people');
                    break;
                }
            }
        }

        var message;

        if (friends.length > 0) {
            message = friends.toString() + " liked this post. ";

            if (!hasLiked) {
                message = message + " I noticed that you did not like this post.  How come?"
            }
        }
        else {
            message = "Nobody liked this post.  Awww.";

            if (!hasLiked) {
                message = message + " Not even you. :(";
            }
        }


        callback(message);
    });
}

exports.handler = (event, context) => {
    var alexa = Alexa.handler(event, context);
    if (event.session.user.accessToken == undefined) {

        alexa.emit(':tellWithLinkAccountCard',
            'to start using this skill, please use the companion app to authenticate on Amazon');

        return;
    }
    alexa.APP_ID = APP_ID;
    // Set the access token for the facebook graph library
    graph.setAccessToken(event.session.user.accessToken);

    /**
     * For development purposes you can set this token to be the one from the facebook graph explorer.
     */
    graph.setAccessToken('');
    // To enable string internationalization (i18n) features, set a resources object.
    alexa.resources = languageStrings;
    alexa.registerHandlers(handlers);
    alexa.execute();
};
