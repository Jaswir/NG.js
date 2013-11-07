(function(exports){

////////////////////////
// THE NEWGROUNDS API //
////////////////////////

var NG = {};
exports.NG = NG;

NG.connect = function( apiId, encryptionKey, movieVersion ){

	// You can pass options either as a config object, or string of arguments.
	var options;
	if(typeof arguments[0]==="object"){
		options = arguments[0];
	}else{
		options = {
			apiId: apiId,
			encryptionKey: encryptionKey,
			movieVersion: movieVersion
		};
	}
	options.movieVersion = options.movieVersion || "";

	// Global settings
	NG.settings = options;
	NG.settings.publisherId = 1;

	// If hosted on NG, attempt to get session variables from querystring
	var query = {};
	window.location.search.replace(
	    new RegExp("([^?=&]+)(=([^&]*))?", "g"),
	    function($0, $1, $2, $3) { query[$1] = $3; }
	);
	_registerSession(query);

	// Get NG Connect parameters
	console.log("== Connecting to Newgrounds... ==");
	return httpRequest({

		tracker_id: NG.settings.apiId,
		command_id: "preloadSettings"

	}).then(function(result){

		// Store properties
		NG.connection = JSON.parse(result);
		NG.medals = NG.connection.medals || [];

		// Complete
		console.log(NG.connection);
		console.log("== Connection Complete! ==");
		return NG.connection;

	});

};

var _registerSession = function(config){
	NG.settings.sessionId = config.NewgroundsAPI_SessionID;
	NG.settings.username = config.NewgroundsAPI_UserName;
	NG.settings.userId = config.NewgroundsAPI_UserID;
};

/*** NG Passport ***/

NG.login = function(){

	var deferred = Q.defer();

    // Open NG Passport in a new window/tab
    var passport = window.open("https://www.newgrounds.com/login/remote/");
    
    // Register incoming session variables, then close window
    window.addEventListener("message",function(event){
        
        // Parse vars
        var sessionVars = event.data.response;
        sessionVars = JSON.parse(decodeURIComponent(sessionVars));
        _registerSession(sessionVars);
        
        // End this
        passport.close();
        deferred.resolve(sessionVars);

    },false);

	// Promise you're logged in
	return deferred.promise;
    
};

/*** NG Medals ***/

NG.getMedal = function(medalName){
	return NG.medals.filter(function(medal){
		return( medal.medal_name == medalName );
	})[0];
};

NG.unlockMedal = function(medalName){

	// Get Medal ID
	var medal = getMedal(medalName);
	if(!medal) return;
	medal.medal_unlocked = true;

	// Secure post
    return _securePost("unlockMedal",{
    	medal_id: medal.medal_id
    })

};



/////////////////////////
// AJAX HELPER METHODS //
/////////////////////////

var NG_SERVER = "http://ncase-proxy.herokuapp.com/www.ngads.com/gateway_v2.php";

function httpRequest(data) {
    var deferred = Q.defer();
	
	var xhr = _createXMLHTTPObject();
	var payload = _encode(data);
	xhr.open("POST", NG_SERVER);
	xhr.setRequestHeader('Content-type','application/x-www-form-urlencoded');
	xhr.onreadystatechange = function() {
		if(xhr.readyState===4 && xhr.status===200){
			deferred.resolve(xhr.responseText);
		}
	};
	xhr.send(payload);

	return deferred.promise;
}

function _createXMLHTTPObject() {
	var XMLHttpFactories = [
	    function(){return new XMLHttpRequest()},
	    function(){return new ActiveXObject("Msxml2.XMLHTTP")},
	    function(){return new ActiveXObject("Msxml3.XMLHTTP")},
	    function(){return new ActiveXObject("Microsoft.XMLHTTP")}
	];
    var xmlhttp;
    for(var i=0;i<XMLHttpFactories.length;i++){
        try{ xmlhttp = XMLHttpFactories[i](); }catch(e){ continue; }
        break;
    }
    return xmlhttp;
}

function _encode(data) {
    var result = "";
    if (typeof data === "string") {
        result = data;
    } else {
        var e = encodeURIComponent;
        for (var k in data) {
            if (data.hasOwnProperty(k)) {
                result += '&' + e(k) + '=' + e(data[k]);
            }
        }
    }
    return result;
}



////////////////////
// SECURE POSTING //
////////////////////

var ENCRYPTOR_RADIX = "/g8236klvBQ#&|;Zb*7CEA59%s`Oue1wziFp$rDVY@TKxUPWytSaGHJ>dmoMR^<0~4qNLhc(I+fjn)X";
var _encryptor = new BaseN(ENCRYPTOR_RADIX);

function _encryptHex(_arg1){
    var _local2 = (_arg1.length % 6);
    var _local3 = "";
    var _local4 = 0;
    while (_local4 < _arg1.length) {
    	var uint = parseInt(("0x" + _arg1.substr(_local4, 6))); // Base 16, coz 0x
        _local3 = ( _local3 + _encryptor.encodeUint(uint,4) );
        _local4 = ( _local4 + 6 );
    };
    return ( (_local2+'') + _local3);
}

function _securePost(command,secureParams){

    // Non-secure parameters
    var postData = {};
    postData.tracker_id = NG.settings.apiId;

    // Random Seed
    var seed = "";
    for(var i=0;i<16;i++) {
        seed = (seed + ENCRYPTOR_RADIX.charAt((Math.random() * ENCRYPTOR_RADIX.length)));
    };
    
    // Secure Metainfo
    postData.command_id = "securePacket";
    secureParams = secureParams || {};
    secureParams.command_id = command;
    secureParams.as_version = 3;
    secureParams.session_id = NG.settings.sessionId;
    secureParams.publisher_id = NG.settings.publisherId;
    secureParams.seed = seed;

    // Encryption
    var salt = md5(seed);
    var str = JSON.stringify(secureParams);
    var key = NG.settings.encryptionKey;
    var encoded = RC4.encrypt(str,key);
    var encrypted = _encryptHex(salt+encoded);
    postData.secure = encrypted;

    // Send request
    return httpRequest(postData).then(function(result,error){
		var result = JSON.parse(result);
		console.log(result);
		return result;
	});

}

})(window);