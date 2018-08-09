/**
 * Method: _users
 * @return {*} OBJECT
 */
DBEvent.prototype._users = function() {
    var syncService = new jEliDBSynchronization(this.name)
        .Entity()
        .configSync({}),
        _secure = '_.users_',
        $promise = new $p(),
        db = this,
        $defer = new DBPromise($promise);

    /**
     * 
     * @param {*} uInfo 
     */
    function addUser(uInfo) {
        if ($isObject(uInfo)) {
            var _newInfo = ({ _ref: GUID(), _data: extend(true, { time: (+new Date) }, uInfo) }),
                //Put the Data
                postData = { data: { insert: [_newInfo] } };
            //use the db API Method
            db.api('PUT', 'crusr', postData, _secure)
                .then(function(res) {
                    //Put the new user
                    var ret = dbSuccessPromiseObject('createUser', "User Created successfully");
                    //if direct login after login
                    //set the getUserInfo and getAccessToken
                    ret.result.getUserInfo = function() {
                        delete _newInfo._data.time;
                        delete _newInfo._data.access;
                        _newInfo.__uid = res.result.lastInsertId;
                        return _newInfo;
                    };

                    ret.result.getLastInsertId = function() {
                        return res.result.lastInsertId;
                    };

                    ret.result.getAccessToken = function() {
                        return res.result.access_info;
                    };

                    ret.getResponseData = function() {
                        return res.result;
                    };

                    if (res.result.ok) {
                        $promise.resolve(ret);
                    } else {
                        $promise.reject(dbErrorPromiseObject('Failed to register User'));
                    }
                }, function() {
                    $promise.reject(dbErrorPromiseObject('Failed to register User'));
                });

        }

        return $defer;
    }

    /**
     * 
     * @param {*} uInfo 
     */
    function removeUser(uInfo) {
        if ($isObject(uInfo)) {
            syncService
                .delete(_secure, [uInfo])
                .then(function(res) {
                    $promise.resolve(dbSuccessPromiseObject('removeUser', "User removed successfully"));
                }, function() {
                    $promise.reject(dbErrorPromiseObject('Failed to remove User'))
                });
        }

        return $defer;
    }


    /**
     * 
     * @param {*} userData 
     */
    function updateUser(userData) {
        if (userData) {
            //post our request to server
            db.api('PUT', 'upusr', { data: { update: [userData] } }, _secure)
                .then(function(res) {
                    res.state = "updateUser";
                    res.result.message = "User Updated successfully";
                    $promise.resolve(res);
                }, function() {
                    $promise.reject(dbErrorPromiseObject('Failed to update User, please try again later'))
                });
        }

        return $defer;
    }


    /**
     * 
     * @param {*} queryData 
     */
    function isExists(queryData) {
        syncService
            .getNumRows(queryData, _secure)
            .then(function(res) {
                $promise.resolve({ isExists: res._jDBNumRows > 0 });
            }, $defer.reject);

        return $defer;
    }



    /**
     * 
     * @param {*} queryData 
     */
    function getUsers(queryData) {
        var postData = { param: queryData, limit: "JDB_SINGLE" };
        //post our request to server
        db.api('POST', 'authusr', postData, _secure)
            .then(function(res) {
                var ret = dbSuccessPromiseObject('authorize', "");
                ret.result.getUserInfo = function() {
                    return res.result._rec;
                };

                ret.result.getAccessToken = function() {
                    return res.result.access_info;
                };

                ret.result.isPasswordReset = function() {
                    return res.result.hasOwnProperty('forcePasswordReset');
                };
                //resolve the promise
                if (!res.result.hasOwnProperty('access_info')) {
                    $promise.reject(dbErrorPromiseObject('Unable to log user in'))
                } else {
                    $promise.resolve(ret);
                }

            }, function(err) {
                $promise.reject(dbErrorPromiseObject(err.message));
            });

        return $defer;
    }

    function removeUserAuthority(postData) {
        return db.api('DELETE', 'rmdbauth', postData);
    }

    function addUserAuthority(postData) {
        return db.api('PUT', 'adbauth', postData)
    }

    return ({
        add: addUser,
        remove: removeUser,
        authorize: getUsers,
        updateUser: updateUser,
        isExists: isExists,
        addAuthority: addUserAuthority,
        removeAuthority: removeUserAuthority
    });
};