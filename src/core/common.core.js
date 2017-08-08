  //Function checks if data is a JSON
  //@return {OBJECT}
  function purifyJSON(data)
  {
    if($isJsonString(data))
    {
      return JSON.parse( data );
    }else
    {
      return undefined;
    }
  }

  //condition setter
  function setCondition(spltQuery)
  {
    var whereTask = spltQuery.slice( parseInt(spltQuery.indexOf("where") + 1) ),
        whereString = whereTask.join(''),
        checkTask = ($isJsonString(whereString)?maskedEval(whereString) : whereString);
      return checkTask;
  }

  //Function to retrieve storage Data
  //@return OBJECT
  function getStorageItem(item)
  {
      //return FN
      return $queryDB.$getActiveDB().$get('_storage_').getItem(item);
  }

  //Function to Store storage data
  //@return JSON String
  function setStorageItem(key,value)
  {
    if(key && value && $isObject(value))
    {
      $queryDB.$getActiveDB()
      .$get('_storage_')
      .setItem(key, value );
    }
  }

  //@Function Delete Storage Item
  function delStorageItem(name)
  {
    if(getStorageItem(name))
    {
      $queryDB.$getActiveDB().$get('_storage_').removeItem(name);
    }

    return true;
  }

  function getDBSetUp(name)
  {
    return ({started : new Date().getTime(),lastUpdated : new Date().getTime(),resourceManager:{}});
  }


  function updateDeletedRecord(ref,obj)
  {
      var checker = getStorageItem($queryDB.$delRecordName),
          _resolvers =  $queryDB.$getActiveDB().$get('resolvers');
      if(checker && checker[obj.db])
      {
        _resolvers.register('deletedRecords', checker[obj.db]);
      }else{
        //Create a new delete Object
        //add a new property : DB_NAME
        checker = {};
        checker[obj.db] = {};
      }

      //Update the resource control
      //only when its table
      if($isEqual(ref,'table'))
      {
        $queryDB.$getActiveDB().$get('resourceManager').removeTableFromResource(obj.name);
      }

      var _delRecords = _resolvers.getResolvers('deletedRecords');
     
      _delRecords[ref][obj.name] = obj.$hash || GUID();


      //extend the delete Object
      //with the current deleteResolver
      checker[obj.db] = _delRecords;
      setStorageItem($queryDB.$delRecordName, checker);
  }
  //Property Watch
  function defineProperty(obj,type,callBack)
  {
      //set watch on stack
      Object.defineProperty(obj, type, 
      {
          configurable: false,
          enumerable: false, // hide from for...in
          writable: false,
          value: callBack
      });
  }

  var inUpdateProgress = 0;
  function fireEvent(fn)
  {
    if(inUpdateProgress)
    {
      setTimeout(function()
      {
        inUpdateProgress = 0;
        fn();
      },1000);

      return;
    }
    fn();
    inUpdateProgress = 1;
  }

  //generate GUID
  //xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  function GUID()
  {
    var rand = function(){ return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);}
    
    function recur(loop,seperator)
    {
        var h="";
        for(var i=0; i<loop; i++)
        {
            h +=rand();
        }

        return h + (seperator || '');
    }

    return recur(2,"-") + recur(1,"-") + recur(1,"-") + recur(1,"-") + recur(3);
  }

  function buildSelectQuery(query){
    var definition = {};
    if(query.length > 3){
      if($isJsonString(query[3])){
        definition = maskedEval(query[3]);
      }else{
        // splice our query
        // set definition
        [].concat.call(query).splice(3).map(function(qKey){
            qKey = qKey.replace(/\((.*?)\)/,"~$1").split("~");
            // function Query
            if(qKey.length > 1){
              if($isJsonString(qKey[1])){
                definition[qKey[0]] = JSON.parse(qKey[1]);
              }else{
                definition[qKey[0]] = qKey[1];
              }
              
            }
        });
      }
    }

    return definition;
  }

  function columnObjFn(columns)
  {
      var obj = {},
          _dbDefaultValueMatcher = function(val){
            switch(val){
              case('CURRENT_TIMESTAMP'):
                val = +new Date;
              break;
              default:
                val = val || null;
              break;
            }

            return val;
          };

      findInList.call(columns,function(idx,n)
      {
        obj[idx] = _dbDefaultValueMatcher(n.defaultValue || n.default);
      });

      return obj;
  }

  function jEliDeepCopy(data){
    return JSON.parse(JSON.stringify(data));
  }

  //@Function Name jEliUpdateStorage
  //Updates the required Database
  function jEliUpdateStorage(dbName, tblName)
  {
    $queryDB.$taskPerformer.updateDB.apply($queryDB.$taskPerformer, arguments);
  }