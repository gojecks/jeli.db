/**
 * 
 * @param {*} appName 
 */
function liveProcessor(appName) {
    var ignoreSync = privateApi.getNetworkResolver('ignoreSync', appName);
    var autoSync = privateApi.getNetworkResolver('live', appName);
    var recordResolver = privateApi.getActiveDB(appName).get('recordResolvers');
    /**
     * 
     * @param {*} type 
     * @param {*} cbSuccess 
     * @param {*} cbError 
     */
    return function(tbl, type, cbSuccess, cbError) {
        if (autoSync && !$inArray(tbl, ignoreSync)) {
            //process the request
            //Synchronize PUT STATE
            var dataToSync = recordResolver.get(tbl, null, 'data');
            if (Object.keys(dataToSync.data[type]).length) {
                syncHelper
                    .autoSync(appName, tbl, dataToSync)
                    .then(cbSuccess, cbError);
            } else {
                dataToSync = null;
                cbSuccess();
            }
        } else {
            cbSuccess();
        }
        // update storage
        jdbUpdateStorage(appName, tbl);
    };
}