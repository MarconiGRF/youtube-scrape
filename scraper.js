const request = require('request');

async function youtube(query, limit, type) {
    return new Promise((resolve) => {
        let json = { results: [], version: require('./package.json').version };

        const videoFilter = "&sp=EgIQAQ%253D%253D";
        const playlistFilter = "&sp=EgIQAw%253D%253D"
        let url = `https://www.youtube.com/results?q=${encodeURIComponent(query)}`;

        if (type === "playlist") {
            url += playlistFilter;
        } else {
            url += videoFilter;
        }

        // Access YouTube search
        request(url, (error, response, html) => {
            // Check for errors
            if (!error && response.statusCode === 200) {

                // Get script json data from html to parse
                let data, sectionLists = [];
                try {
                    let match = html.match(/ytInitialData[^{]*(.*"adSafetyReason":[^;]*});/s);
                    if (match && match.length > 1) { }
                    else {
                        match = html.match(/ytInitialData"[^{]*(.*);\s*window\["ytInitialPlayerResponse"\]/s);
                    }
                    data = JSON.parse(match[1]);
                    sectionLists = data.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents;
                }
                catch(ex) {
                    console.error("Failed to parse data:", ex);
                    console.log(data);
                }

                // Loop through all objects and parse data according to type
                parseJsonFormat(sectionLists, json, limit);
    
                return resolve(json);
            }
            resolve({ error: error });
        });
        
    });
};

/**
 * Parse youtube search results from json sectionList array and add to json result object
 * @param {Array} contents - The array of sectionLists
 * @param {Object} json - The object being returned to caller
 * @param {Number} limit - The limits of results to be returned
 */
function parseJsonFormat(contents, json, limit) {
    contents.forEach(sectionList => {
        try {
            if (sectionList.hasOwnProperty("itemSectionRenderer")) {
                for (let index = 0; index < limit && index < sectionList.itemSectionRenderer.contents.length; index++) {
                    try {
                        if (sectionList.itemSectionRenderer.contents[index].hasOwnProperty("videoRenderer")) {
                            json.results.push(parseVideoRenderer(sectionList.itemSectionRenderer.contents[index].videoRenderer));
                        }
                        if (sectionList.itemSectionRenderer.contents[index].hasOwnProperty("playlistRenderer")) {
                            json.results.push(parsePlaylistRenderer(sectionList.itemSectionRenderer.contents[index].playlistRenderer));
                        }
                    }
                    catch(ex) {
                        console.error("Failed to parse renderer:", ex);
                        console.log(content);
                    }
                }
            }
        }
        catch (ex) {
            console.error("Failed to read contents for section list:", ex);
            console.log(sectionList);
        }
    });
}

/**
 * Parse a playlistRenderer object from youtube search results
 * @param {object} renderer - The playlist renderer
 * @returns object with data to return for this playlist
 */
function parsePlaylistRenderer(renderer) {
    let thumbnails = renderer.thumbnailRenderer.playlistVideoThumbnailRenderer.thumbnail.thumbnails;
    let playlist = {
        "type": "playlist",
        "id": renderer.playlistId,
        "title": renderer.title.simpleText,
        "url": `https://www.youtube.com${renderer.navigationEndpoint.commandMetadata.webCommandMetadata.url}`,
        "thumbnail_src": thumbnails[thumbnails.length - 1].url
    };

    let uploader = {
        "username": renderer.shortBylineText.runs[0].text,
        "url": `https://www.youtube.com${renderer.shortBylineText.runs[0].navigationEndpoint.commandMetadata.webCommandMetadata.url}`
    };

    return { content: playlist, uploader: uploader };
}

/**
 * Parse a videoRenderer object from youtube search results
 * @param {object} renderer - The video renderer
 * @returns object with data to return for this video
 */
function parseVideoRenderer(renderer) {
    let video = {
        "type": "video",
        "id": renderer.videoId,
        "title": renderer.title.runs.reduce(comb, ""),
        "url": `https://www.youtube.com${renderer.navigationEndpoint.commandMetadata.webCommandMetadata.url}`,
        "upload_date": renderer.publishedTimeText ? renderer.publishedTimeText.simpleText : "Live",
        "thumbnail_src": renderer.thumbnail.thumbnails[renderer.thumbnail.thumbnails.length - 1].url
    };

    let uploader = {
        "username": renderer.ownerText.runs[0].text,
        "url": `https://www.youtube.com${renderer.ownerText.runs[0].navigationEndpoint.commandMetadata.webCommandMetadata.url}`
    };
    uploader.verified = renderer.ownerBadges &&
        renderer.ownerBadges.some(badge => badge.metadataBadgeRenderer.style.indexOf("VERIFIED") > -1) || 
        false;

    return { content: video, uploader: uploader };
}

/**
 * Combine array containing objects in format { text: "string" } to a single string
 * For use with reduce function
 * @param {string} a - Previous value
 * @param {object} b - Current object
 * @returns Previous value concatenated with new object text
 */
function comb(a, b) {
    return a + b.text;
}

module.exports.youtube = youtube;