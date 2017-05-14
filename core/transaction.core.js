//@Function Name {jTblQuery}
//@argument {object}
// @return Object

function jTblQuery(tableInfo,mode,isMultipleTable, tables){

    var select = "",
      executeState = [],
      data = [],
      leftTableData = [],
      tblMode = mode || 'read',
      join = [],
      errLog = [],
      _skipped = [],
      _recordResolvers = $queryDB.$getActiveDB(tableInfo.DB_NAME).$get('recordResolvers');

      function setDBError(msg)
      {
        if(!expect(errLog).contains(msg))
        {
          errLog.push( msg );
        }
      }

    //Check if Table Information is available from the DB
      if(!$isObject(tableInfo))
      {
        errorBuilder('Unable to perform query at the moment, please try again later');
      }

    //Check the required Mode
    if(expect(tblMode).contains('write'))
    {
      //set variable for processed Data
        var processedData = [],
            processState = null;
        this.insert = function()
        {
          var _data = arguments,
              columnObj = columnObjFn(tableInfo.columns[0]),
              l;

          /*
              Check if the our arguments is 1
              if also the argument is an array
              replace variable arg with arg[0]
          */
          if(_data.length === 1){
            if($isArray(_data[0])){
              _data = _data[0];
            }
          }

          if(_data.length && columnObj)
          {
              for(l=0; l <= _data.length-1;l++)
              {
                  var type = ($isObject(_data[l])?'object':'array'),
                      cdata = {};
                  
                  //switch type
                  switch(type)
                  {
                    case('object'):
                      cdata = _data[l];
                    break;
                    case('array'):
                      var columnKeys = Object.keys(columnObj),
                          k;
                        //loop through the 
                        for(k in columnKeys)
                        {
                          cdata[ columnKeys[k] ] = _data[l][k];
                        }                 
                    break;
                  }

                  if(processData(cdata,l))
                  {
                    var tableConfig = tableInfo.columns[0],
                        pData = extend({},columnObj,cdata);
                    

                      // check indexing
                      var _dataExists = false,
                          _ref = GUID();
                      for(var _index in tableInfo.index){
                        var _currentIndexCheck = tableInfo.index[_index];
                        if(_currentIndexCheck.indexes){
                            // check the the index already exists
                            if(_currentIndexCheck.indexes[pData[_index]]){
                              if(_currentIndexCheck.unique){
                                _dataExists = true;
                                _skipped.push(_currentIndexCheck.indexes[pData[_index]]);
                              }
                            }else{
                              _currentIndexCheck.indexes[pData[_index]] = _ref;
                            }
                        }else{
                          _currentIndexCheck.indexes = {};
                          _currentIndexCheck.indexes[pData[_index]] = _ref;
                        }
                      }

                      //push data to processData array
                      //set obj ref GUID
                      if(!_dataExists){
                        tableInfo.lastInsertId++;

                        //update the data to store
                        findInList.call(pData,function(i,n)
                        {  
                            //check auto_increment
                            if(!n && tableConfig[i].hasOwnProperty('AUTO_INCREMENT'))
                            {
                              pData[i] = tableInfo.lastInsertId;
                            }
                        });

                        var newSet = {}
                          newSet['_ref'] = _ref;
                          newSet['_data'] = pData;
                        processedData.push( newSet );
                      }
                  }                   
              }

              if(!$isEqual(processState,"insert"))
              {
                executeState.push(["insert",function(disableOfflineCache)
                {
                    //errorLog Must be empty
                    if(errLog.length)
                    {
                      //clear processed Data
                      processedData = [];
                      throw new Error(errLog);
                    }

                    // update offline
                    if(!disableOfflineCache){
                      updateOfflineCache('insert',processedData);
                    }

                    /**
                        broadcast event
                    **/
                    $queryDB.storageEventHandler.broadcast('onInsert',[tableInfo.TBL_NAME, processedData]);
                    
                    //push records to our resolver
                        
                    return updateTable( processedData.length );
                }]);
              }

              processState = "insert";
          }

          return this;
        };

        // @Function : update
        // @Arguments : parameter[0] (OBJECT || String),parameter[1] (STRING)
        // @Return {Object}
        // @ExecuteState : return Message {STRING}

        this.update = function(updateData,query)
        {
            //convert our query
            //Function structureUpdateData()
            function structureUpdateData(setData)
            {
              // return setData when its an object
              if($isObject(setData)){
                return setData;
              }else{
                //check if setData is a string
                var setData = maskedEval(setData);
                switch(typeof setData){
                  case('string'):
                    //convert String Data to Object
                    var nString =  removeSingleQuote(setData),
                        splitComma = nString.split(","),
                        i = splitComma.length,
                        tempObj = {};
                    //Loop through the split Data
                    while(i--)
                    {
                      var splitEqualTo = splitComma[i].split("=");
                      //set the new Object Data
                      tempObj[splitEqualTo[0]] = splitEqualTo[1];
                    }
                    return tempObj;
                  break;
                  case('object'):
                      return setData;
                  break;
                  default:
                    setDBError('Unable to update Table, unaccepted dataType recieved');
                  break;
                }
              }
            }

              //@Arguments.length is 1
              //@query is undefined
              if(!query && $isString(updateData))
              {
                var splitUpdate = $removeWhiteSpace(updateData).split(/(?:where):/gi),
                    updateData =  splitUpdate.shift(),
                    query = splitUpdate.pop();
              }


                var where = (query)?removeSingleQuote(query):!1,
                    setData = structureUpdateData(updateData),
                    u = tableInfo.data.length,
                    updated = 0,
                    store = function(idx)
                    {
                      //set the current Value
                        tableInfo.data[idx]._data = extend({},tableInfo.data[idx]._data,setData);
                        updated++;
                        rowsToUpdate.push(tableInfo.data[idx]);
                    },
                    rowsToUpdate = [],
                    $self = this;
                executeState.push(["update",function(disableOfflineCache)
                {
                  //Execute Function 
                  //Kill Process if error was Found
                    if(errLog.length || !setData)
                    {
                      throw Error(errLog);
                    }else
                    {
                        if(where)
                        {
                          new $query(tableInfo.data)._(where,function(item,idx)
                          {
                              //store the data
                              store(idx);
                          });
                        }else
                        {
                          while(u--)
                          {
                                store(u);
                          }
                        }

                        //push records to our resolver
                        if(!disableOfflineCache){
                          updateOfflineCache('update',rowsToUpdate);
                        }

                        /**
                            broadcast event
                        **/
                        $queryDB.storageEventHandler.broadcast('onUpdate',[tableInfo.TBL_NAME, rowsToUpdate]);

                       //empty the rows 
                        rowsToUpdate = [];

                        //return success
                        return {message:updated+" row(s) updated."};
                      }
                }]);

            return this;
        };

        //@Function lastInsertId
        //@parameter null
        //@return INTERGER

        this.lastInsertId = function()
        {
            return tableInfo.lastInsertId;
        };

        //@Function Delete
        //@Arguments 'Query'
        //@return Object
        //@ExecuteState return {obj}

        this['delete'] = function(query)
        {
            if(query)
            {
              var delItem = [];
              new $query(tableInfo.data)._(query,function(item,idx){
                delItem.push(item);
              });

              executeState.push(["delete",function(disableOfflineCache)
              {
                  if(!delItem.length)
                  {
                    throw Error(["No record(s) to remove"]);
                  }else
                  {
                      tableInfo.data = tableInfo.data.filter(function(item)
                      {
                        return !$inArray(item,delItem);
                      });


                        //push records to our resolver
                        if(!disableOfflineCache){
                          updateOfflineCache('delete',delItem);
                        }

                        /**
                            broadcast event
                        **/
                        $queryDB.storageEventHandler.broadcast('onDelete',[tableInfo.TBL_NAME, delItem]);

                      //return success Message
                      return ({
                                message : delItem.length + " record(s) removed"
                              });
                  }
                }]);
              }

              return this;
        };

                //Update the table content
            function updateTable(totalRecords)
            {
                if($isArray(processedData) && totalRecords)
                {
                  tableInfo.data.push.apply(tableInfo.data,processedData);
                }

                //return success after push
                processedData = [];

                return ({
                          message : totalRecords + " record(s) inserted successfully, skipped "+_skipped.length+" existing record(s)"
                      });
            }
    }

  if(expect(tblMode).contains('read'))
  {
    if(isMultipleTable)
    {
        //Query Logic Object
      //Where and SortBy Logics
      this.condition = new $query(tableInfo.data);
    }

        //get table column
        this.getColumn = function(col,data,limit)
        {
          //set the data to get column info from
          var columns = col.split(','),
              retData = [],
              data = getTableData(),
              d;

          //@Function Name perFormLimitTask
          function performLimitTask(cdata)
          {
            if(limit)
             {
                var _startEnd = limit.split(',');
                return jEli.$copy(cdata.splice(parseInt(_startEnd[0]),parseInt(_startEnd[1])), true);
             }

             return jEli.$copy(cdata, true);
          }

            //loop through the data
            //return the required column
          if(!$isEqual(col,'*'))
          {
            for(d in data)
            {
              setColumnData();
            }
          }else
          {
            return performLimitTask(data);
          }


          //Function getTbale data
          function getTableData()
          {
            //return data when its defined
              if($isArray(data))
              {
                return data;
              }else if(tableInfo.data) //return data when single table search
              {
                return tableInfo.data;
              }
              else if($isString(data))
              {
                return tableInfo[data].data;
              }else
              {
                return [];
              } 
          }
           

           //set the object to be returned
           function setColumnData()
           {
              var odata = {},
                  fnd = 0,
                  _cLen = columns.length;
              while(_cLen--)
              {
                var aCol = columns[_cLen],
                    fieldName,
                    tCol,
                    cData;


                //if fieldName contains table name
                if(expect(aCol).contains('.'))
                {
                  var spltCol = aCol.split(".");
                      tCol = $removeWhiteSpace(spltCol[0]);
                      // split our required column on ' as '
                      fieldName = spltCol[1].split(' as ');
                      // set the data
                      cData = data[d][tCol] || data[d];

                      //AS Clause is required 
                      if(expect(aCol).contains(' as '))
                      {
                        tCol = false;
                      }
                }else
                {
                  fieldName = aCol.split(' as ');
                  cData = data[d];
                }

                  // remove whiteSpace from our fieldName
                  fieldName = JSON.parse($removeWhiteSpace(JSON.stringify(fieldName))) ;               

                var
                    _as = fieldName.pop(),
                    field =  fieldName.length?fieldName.shift():_as;

                  //set the data
                  if($isEqual(field,'*')){
                    odata[_as] = cData;
                  }else{
                    odata[_as] = cData[field];
                  }
                  
                  fnd++;
              }

              if(fnd && !(JSON.stringify(retData).indexOf(JSON.stringify(odata)) >-1))
              {
                retData.push(odata);
              }

           }

           //return the data

            return performLimitTask( retData );
        };    


    this.select = function(query)
    {
            var selectQuery = selectQuery,
                whereQuery = false,
                _onClause = false,
                _joinTypeFn = "",
                _joinTable = "",
                $self = this,
                _sData = [],
                _qTables = [],
                _limit;

              //@Function Name processQueryData
              //@Arguments nill
              // 
              function processQueryData()
              {
                if(query)
                {
                  //Split through the queryColumn
                  var queryColumn = query.split(",");

                  if(_joinTable && $isEqual(query,'*'))
                  {
                    setDBError('Invalid Select Statment.');
                  }

                  //Loop through queryColumn
                  findInList.call(queryColumn,function(i,n)
                  {
                      if(expect(n).contains("."))
                      {
                        if(isMultipleTable)
                        {
                            var splitColumn = n.split("."),
                            tblName = $removeWhiteSpace(splitColumn[0]);
                            //reference to the tables
                            if(!tableInfo[tblName])
                            {
                              setDBError(tblName +" was not found, Include table in transaction Array eg: db.transaction(['table_1','table_2'])");
                            }
                        }else
                        {
                          setDBError("Single table SELECT query doesn't require tableName.columnName #:"+n);
                        }
                        
                      }
                  });
                }
              }


          //FUnction for Join Clause
          //@Function Name : setJoinTypeFn
          //@Argument : BOOLEAN true:false
          //@return Function(resolver)
          function setJoinTypeFn(processed,processedData,totalRecord,counter)
          {
            //INNER JOIN FN
            //@argument resolver {OBJECT}
              return function(resolver,clause)
              {
                switch(_joinTypeFn)
                {
                    //INNER JOIN FN
                    //@argument resolver {OBJECT}
                    case('inner'):
                      if(processed)
                      {
                        _sData.push(resolver);
                      }
                    break;
                    //LEFT JOIN FN
                    //RIGHT JOIN FN
                    //@argument resolver {OBJECT}
                    case('left'):
                    case('right'):
                      //push all left table to array
                      if(!processed)
                      {
                        _sData.push( resolver );
                      }else
                      {
                        _sData.push.apply(_sData,processedData)
                      }
                    break;

                    //OUTTER JOIN FN
                    //@argument resolver {OBJECT}
                    //Algorithm : Match the lefttable before right
                    case('outer'):
                      if(expect(clause).contains('left'))
                      {
                        if(!processed)
                        {
                          _sData.push( resolver );
                        }else
                        {
                          _sData.push.apply(_sData,processedData)
                        }
                      }else
                      {
                        if(!processed)
                        {
                          _sData.push( resolver );
                        }
                      }
                    break;
                }
              }
            }

              //Function Table Matcher
              function matchTableFn(clause)
              {
                var startLogic = _onClause[0].split("."),
                    innerLogic = _onClause[1].split("."),
                    startTable = tableInfo[startLogic[0]].data,
                    innerTable = tableInfo[innerLogic[0]].data,
                    innerLength = innerTable.length,
                    startLength = startTable.length,
                    leftTable = startTable,
                    rightTable = innerTable,
                    leftLogic = startLogic[1],
                    rightLogic = innerLogic[1],
                    leftTableLogic = startLogic[0],
                    rightTableLogic = innerLogic[0];

                  if($isEqual(clause,"right"))
                  {
                    leftTable = innerTable;
                    rightTable = startTable;
                    leftLogic = innerLogic[1];
                    rightLogic = startLogic[1];
                    leftTableLogic = innerLogic[0];
                    rightTableLogic = startLogic[0];
                  }

                  var totalLeftRecord = leftTable.length,
                      counter = 0;

                //start process
                //query the leftTable Data
                expect(leftTable).search(null,function(lItem,lIdx)
                {
                  var resObject = {},
                      _ldata = lItem._data,
                      $isFound = 0,
                      $foundObj = [];
                      resObject[leftTableLogic] = _ldata;
                      resObject[rightTableLogic] = {};
                    //Pass other filter
                    expect(rightTable).search(null,function(rItem,rIdx)
                    {
                        //check match
                        var _rdata = rItem._data;
                        if( $isEqual(_ldata[leftLogic],_rdata[rightLogic]) )
                        {
                          resObject[rightTableLogic] = _rdata;
                          var temp = {};
                              temp[leftTableLogic] = _ldata;
                              temp[rightTableLogic] = _rdata;
                          $foundObj.push(temp);
                          $isFound++;
                        }
                       
                        return true
                    });

                    counter++;
                    setJoinTypeFn( $isFound, $foundObj, totalLeftRecord , counter )( resObject, clause );
                    return true
                });
  
                return ({
                          recur : function(match)
                          {
                            return matchTableFn(match)
                          }
                      });
              }

              //reference our select query
              if(!query)
              {
                setDBError("Left Table Query is required");
              }

            //Push our executeState Function into Array
            executeState.push(["select",function()
            {
              //check if join is required
              processQueryData();

              if(errLog.length)
              {
                //Throw new error
                throw new Error(errLog);
              }else
              {
                  if(_onClause)
                  {

                    //Table matcher
                    //Matches the leftTable to RightTable
                    //returns both Match and unMatched Result
                    switch(_joinTypeFn)
                    {
                      case('outer'):
                        matchTableFn('left').recur('right');
                      break;
                      default:
                        matchTableFn(_joinTypeFn);
                      break;
                    }

                    if(whereQuery)
                    {
                      return new $query( $self.getColumn(query, _sData,_limit) )._(whereQuery);
                    }else{
                      
                      return  $self.getColumn(query, _sData,_limit);
                    }

                  }else
                  {
                    _sData = tableInfo.data;
                  }

                  //return the processed Data
                  return $self.getColumn(query,new $query(_sData)._(whereQuery),_limit );
              }
            }]);

              var joinClause = function(type,table)
              {
                _joinTypeFn = type;
                _joinTable = table;
                  return ({
                    on:function(oQuery)
                    {
                      if(oQuery)
                      {
                        //perform the query
                        _onClause = $removeWhiteSpace( oQuery ).split("=");
                      }else
                      {
                        //Push new error
                        setDBError(type.toUpperCase() +' JOIN clause was required but was never used.');
                      }


                      return ({
                                execute : $self.execute,
                                where : whereClause,
                                limit:limit
                              });  
                    }
                  });
              },
              whereClause = function(query)
              {
                
                //store where query
                whereQuery = query;
                  return ({
                      limit : limit,
                      execute : $self.execute  
                  });
              },
              limit = function(parseLimit){
                  _limit = parseLimit;

                  return ({
                    execute : $self.execute
                  });
              };


            return ({
                      join:function(statement)
                      {
                        if(expect(statement).contains(':'))
                        {
                          var clause = $removeWhiteSpace( statement ).split(":"),
                              type = clause.shift().toLowerCase(),
                              table = clause.pop();

                          if($inArray(type,["inner","left","right","outer"]))
                          {
                              return joinClause(type,table);
                          }else
                          {
                            setDBError("Invalid join clause used ("+type+")");
                          }
                        }else
                        {
                          setDBError("JOIN clause requires a table Name e.g(inner:tablename)");
                        }

                        return joinClause(undefined);
                      },
                      limit:limit,
                      where : whereClause,
                      execute : this.execute
                  });
        };
  }




    this.execute = function(disableOfflineCache)
    {
      if(executeState.length)
      {
          var defer = new $p(),
              error = !1;

          findInList.call(executeState,function(idx,ex)
          {
              if(ex.length > 1)
              { 
                var ret = {state:ex[0]};
                  try
                  {
                    var res = ex[1].call(ex[1], disableOfflineCache);
                    sqlResultExtender( ret , res );
                  }catch(e)
                  {
                    ret.message = e.message;
                    error = true;
                  }finally
                  {
                    defer[!error?'resolve':'reject'](ret);
                    destroyGlobalArguments();

                    if(expect(["insert","update","delete"]).contains(ex[0]) && !error)
                    {
                        // life processor
                        liveProcessor(tableInfo.TBL_NAME,tableInfo.DB_NAME)(ex[0]);
                        $queryDB.stack.push(function()
                        {
                          $queryDB.$taskPerformer.updateDB(tableInfo.DB_NAME,tableInfo.TBL_NAME);
                        });
                    }
                  }
              }
          });

          return new DBPromise(defer);
      }
    };

    //destroy ALL Global Arguments
    //This should be called after excute is perfomed
    function destroyGlobalArguments()
    {
        select = "";
        executeState = [];
        data = [];
        leftTableData = [];
        join = [];
        errLog = [];
        _skipped = [];
    }

    //rowback function
    function rowBack(state)
    {
      //Check State
      //Write mode must be enable
        if(state && $inArray(state,["insert","delete","update"]))
        {

        }
    }

    function _convertObjectToParam(query){
        //whereClause query Accepts Object
        //Pass the parameter sent to the query
        if($isObject(query)){
          var objToStr = "",
              keys = Object.keys(query).length-1, //get keys length of the query Object
              inc = 0;
          //iterate through the Object
          //convert the name and value pairs to query string
          findInList.call(query,function(name,value){
              objToStr+=name+"='"+value+"'";
              if(keys > inc){
                objToStr+=" && ";
              }

              inc++;
          });

          //set the query to str
          query = objToStr;
        }


        return query;
    }

    //columnTypeChecker
    function columnTypeChecker(data,requiredType,mtype)
    {
          var type = typeof data,
              retType = false;

          switch(requiredType)
          {
            case('varchar'):
            case('text'):
            case('string'):

              if($isEqual(type,'string'))
              {
                retType = type;
              }

            break;
            case('number'):
            case('integer'):
            case('int'):
            case("smallint"):
            case("bigint"):
              if($isNumber(data) || !isNaN(Number(data)))
              {
                retType = type;
              }
            break;
            case("double"):
            case("decimal"):
            case("long"):
              if($isDouble(data)){
                retType = type;
              }
            break;
            case('boolean'):
              if(!isNaN(Number(data))){
                retType = type;
              }
            break;
            case("float"):
              if($isFloat(data)){
                retType = type;
              }
            break;
            case('datetime'):
            case("timestamp"):
            case("date"):
              if(new Date(data) instanceof Date)
              {
                retType = requiredType;
              }
            break;
            case('object'):
            case('array'):
            case('blob'):
              if($isObject(data) || $isArray(data)){
                retType = requiredType;
              }
            break;
            case('any'):
              retType = type;
            break;
          }



        return retType;
    }

    function processData(cData,dataRef)
    {
        //Process the Data
        var columns = tableInfo.columns[0],
            passed = 1;
        if(cData)
        {
            findInList.call(cData,function(idx,val)
            {
                //check if column is in table
                if(!columns[idx])
                {
                  //throw new error
                  setDBError('column ('+idx+') was not found on this table ('+tableInfo.TBL_NAME+'), to add a new column use the addColumn FN - ref #'+dataRef);
                  passed=!1;

                  return;
                }

                var type = typeof cData[idx],
                    cType = columnTypeChecker( cData[idx], (columns[idx].type || 'STRING').toLowerCase(), type );
                if(!cType)
                {
                  setDBError(idx +" Field requires "+cType+", but got "+type + "- ref #"+dataRef);
                  passed=!1;
                }
            });

            return passed;
        }

        return !1;
    }

    function updateOfflineCache(type, data){
        _recordResolvers
        .$set(tableInfo.TBL_NAME)
        .data(type,data);
    }
}