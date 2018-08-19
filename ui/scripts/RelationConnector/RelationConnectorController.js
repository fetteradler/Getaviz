var relationConnectorController = function(){
	
	var sourceEntity = null;
	var relatedEntities = new Array();

	// entities the source calls
	var relatedCallsEntities = new Array();
	//entities the source is called by
    var relatedCalledByEntities = new Array();

    //Conditions/Loops
	var accessWithArray = new Array();
	var hasMultipleElements = false;
    var inCondition = false;
    var inLoop = false;
	
	var connectors = new Array();
	var relations = new Array();
	
	var loadedMin		= new Map();
	var loadedMax		= new Map();
	var loadedPositions = new Map();
	var loadedDistances = new Map();

	var activated = false;

	//Vererbung
	var superClasses = new Array();
	var subClasses = new Array();
	
	
	//config parameters	
	var controllerConfig = {
		fixPositionZ : false,
		showInnerRelations : false,
		elementShape : "",					//circle, square
		sourceStartAtParentBorder : false,
		targetEndAtParentBorder : false,
		sourceStartAtBorder: false,
		targetEndAtBorder: false,
		createEndpoints : false,
	}
	
	
	function initialize(setupConfig){	

		application.transferConfigParams(setupConfig, controllerConfig);	
		
		loadPositionData(multipartJsonUrl);		
				
		events.selected.on.subscribe(onRelationsChanged);
	}
	
	function activate(){	
		activated = true;
		if(relatedEntities.length != 0){
			createRelatedConnections();
		}
	}

	function deactivate(){
		reset();
		activated = false;
	}
	
	function reset(){
		removeAllConnectors();
	}
	
	function loadPositionData(filePath){
		$.getJSON( filePath, function( data ) {
			
			events.log.info.publish({ text: "connector - loadPositionData"});

			data.mapping.forEach(function(mapping) {
				
				var min = parseObjectPosition(mapping.min);
				var max = parseObjectPosition(mapping.max);
				
				var connectorPosition = [];
				var connectorDistance = [];
				for (var index = 0; index < min.length; ++index) {						
					connectorPosition[index] = ( Math.abs( max[index] - min[index] ) / 2 ) + min[index];
					connectorDistance[index] = Math.abs( max[index] - min[index] ) / 2;
				}									

				loadedMin.set(mapping.name, min);
				loadedMax.set(mapping.name, max);
				loadedPositions.set(mapping.name, connectorPosition);
				loadedDistances.set(mapping.name, connectorDistance);
			});			
			
		});					
	}
	
	function removeAllConnectors(){	
		
		events.log.info.publish({ text: "connector - removeAllConnectors"});

		if( connectors.length == 0){
			return;
		}
		
		//remove scene elements
		connectors.forEach(function(connector){
			canvasManipulator.removeElement(connector);
		});
		
		connectors = new Array();
		
		//remove relation entities
		relations.forEach(function(relation){
			 model.removeEntity(relation);
		});
		
		
		
		//publish removed entities
		var applicationEvent = {			
			sender: relationConnectorController,
			entities: relations
		};
		events.added.off.publish(applicationEvent);
	}
	
	
	
	function onRelationsChanged(applicationEvent) {
		
		events.log.info.publish({ text: "connector - onRelationsChanged"});

		removeAllConnectors();
		
		//get related entites
		sourceEntity = applicationEvent.entities[0];	
		
		events.log.info.publish({ text: "connector - onRelationsChanged - selected Entity - " + sourceEntity.name});

		relatedEntities = new Array();
			
		switch(sourceEntity.type) {
			case "Class":
				relatedEntities = relatedEntities.concat(sourceEntity.superTypes);
				relatedEntities = relatedEntities.concat(sourceEntity.subTypes);

				superClasses = sourceEntity.superTypes;
				subClasses = sourceEntity.subTypes;
				break;
			case  "ParameterizableClass":
				relatedEntities = relatedEntities.concat(sourceEntity.superTypes);
				relatedEntities = relatedEntities.concat(sourceEntity.subTypes);

                superClasses = sourceEntity.superTypes;
                subClasses = sourceEntity.subTypes;
				break;			
			case "Attribute":
				relatedEntities = sourceEntity.accessedBy;
				break;
			case "Method":
				relatedEntities = sourceEntity.accesses;
				relatedEntities = relatedEntities.concat( sourceEntity.calls );
				relatedEntities = relatedEntities.concat( sourceEntity.calledBy );

                relatedCallsEntities = sourceEntity.calls;
                relatedCalledByEntities = sourceEntity.calledBy;
				break;
			
			default: 				
				return;
		}

		events.log.info.publish({ text: "connector - onRelationsChanged - related Entites - " + relatedEntities.length});
		
		if(relatedEntities.length == 0) {
			return;
		}

		if(activated){
			createRelatedConnections();
		}
		
	}


	function createRelatedConnections(){

		var relatedEntitesMap = new Map();
						
		relatedEntities.forEach(function(relatedEntity){

            inCondition = false;
            inLoop = false;

			if(sourceEntity.extendedAccesses) {
			    var extAccess = sourceEntity.extendedAccesses;
			    for(var i = 0; i < extAccess.length; i++) {
                    if (extAccess[i][0] == relatedEntity) {
                        //inCondition = true;
                        if (extAccess[i][1]) {
                            inCondition = true;
                        }
                        if (extAccess[i][2]) {
                            inLoop = true;
                        }
                    }
                }
            }

            if(sourceEntity.extendedCalls) {
                var extCall = sourceEntity.extendedCalls;
                for(var i = 0; i < extCall.length; i++) {
                    if (extCall[i][0] == relatedEntity) {
                        if (extCall[i][1]) {
                            inCondition = true;
                        }
                        if (extCall[i][2]) {
                            inLoop = true;
                        }
                    }
                }
            }

            if(sourceEntity.extendedCalledBy) {
                var extCallBy = sourceEntity.extendedCalledBy;
                for(var i = 0; i < extCallBy.length; i++) {
                    if (extCallBy[i][0] == relatedEntity) {
                        if (extCallBy[i][1]) {
                            inCondition = true;
                        }
                        if (extCallBy[i][2]) {
                            inLoop = true;
                        }
                    }
                }
            }

			if(relatedEntitesMap.has(relatedEntity)){
				events.log.info.publish({ text: "connector - onRelationsChanged - multiple relation"});
				return;
			}
			
			if(controllerConfig.showInnerRelations === false){
				if(isTargetChildOfSourceParent(relatedEntity, sourceEntity)){
					events.log.info.publish({ text: "connector - onRelationsChanged - inner relation"});
					return;
				}
			}

			//create scene element
			var connector = createConnector(sourceEntity, relatedEntity);
			
			//target or source not rendered -> no connector -> remove relatation
			if( connector === undefined){				
				return;
			}

			events.log.info.publish({ text: "connector - onRelationsChanged - create connector"});
			
			connectors.push(connector);
			canvasManipulator.addElement(connector);
			
			//create model entity
			var relation = model.createEntity(
				"Relation", 
				sourceEntity.id + "--2--" + relatedEntity.id,
				sourceEntity.name + " - " + relatedEntity.name,
				sourceEntity.name + " - " + relatedEntity.name,
				sourceEntity
			);
			
			relation.source = sourceEntity;
			relation.target = relatedEntity;
			
			relations.push(relation);
			
			relatedEntitesMap.set(relatedEntity, relatedEntity);

            hasMultipleElements = false;
		});
		
		
		if(relatedEntitesMap.size != 0){
		
			var applicationEvent = {
				sender: relationConnectorController,
				entities: relations
			};
			events.added.on.publish(applicationEvent);			
		}

	}

	
	function createConnector(entity, relatedEntity){
		//calculate attributes						
		var sourcePosition = calculateSourcePosition(entity, relatedEntity);
		if( sourcePosition === null ){
			return;
		}
		
		var targetPosition = calculateTargetPosition(entity, relatedEntity);
		if( targetPosition === null ){
			return;
		}

        var connectorColor = null;

		var hasDirection = false;

		var hasCondition = false;

		var switchClassOrMethod = 0;
		//var inCondition = false;
		//var inLoop = false;

		if(entity.type === "Method") {

            switchClassOrMethod = 1;
            //Check type of related entity
			if(relatedEntity.type === "Method") {
				if(inCondition) {
					hasCondition = true;
					connectorColor = "#ADFF2F";
				} else if (inLoop) {
                    hasCondition = true;
					connectorColor = "#006400";
				} else {
                    connectorColor = "#00FF00";
                }
				hasDirection = true;
			} else {
                if(inCondition) {
                	hasCondition = true;
                    connectorColor = "#FF7256";
                } else if (inLoop) {
                    hasCondition = true;
                    connectorColor = "#8B0000";
                } else {
                   // connectorColor = "0 0 1";
                    connectorColor = "#FF0000";
                }
			}
		} else if(entity.type === "Attribute") {
            if(inCondition) {
                hasCondition = true;
                connectorColor = "#FF7256";
            } else if (inLoop) {
                hasCondition = true;
                connectorColor = "#8B0000";
            } else {
                // connectorColor = "0 0 1";
                connectorColor = "#FF0000";
            }
		} else if (entity.type === "Class") {
            switchClassOrMethod = 2;
            hasDirection = true;
			//if (superClasses.contains(relatedEntity)) {
                connectorColor = "#FFD700";
			/*} else if (subClasses.contains(relatedEntity)) {
                connectorColor = "#FFD700";
			}*/
		} else {
		    hasDirection = true;
            connectorColor = "#FF1493";
        }

		var connectorSize = 0.5;
		
		//config
		if(controllerConfig.fixPositionZ){
			sourcePosition[2] = controllerConfig.fixPositionZ;
			targetPosition[2] = controllerConfig.fixPositionZ;
		}
		
		//create element
		var transform = document.createElement('Transform');

		var numberCalls = 0;
        for(var i = 0; i < relatedEntities.length; i++) {
            if (relatedEntities[i] == relatedEntity) {
                numberCalls++;
            }
        }

        if(hasDirection) {
        	//
			switch (switchClassOrMethod) {
				case 1:
                    for(var i = 0; i < relatedCallsEntities.length; i++) {
                        if (relatedCallsEntities[i] == relatedEntity) {
                            transform.appendChild(createArrow(sourcePosition, targetPosition, connectorColor, connectorSize, numberCalls));
                            break;
                        }
                    }
                    for(var i = 0; i < relatedCalledByEntities.length; i++) {
                        if (relatedCalledByEntities[i] == relatedEntity) {
                            transform.appendChild(createArrow(targetPosition, sourcePosition, connectorColor, connectorSize, numberCalls));
                            break;
                        }
                    }
                    break;

				case 2:
                    for (var i = 0; i < superClasses.length; i++) {
                        if (superClasses[i] == relatedEntity) {
                            transform.appendChild(createArrow(sourcePosition, targetPosition, connectorColor, connectorSize, 1));
                        }
                    }
                    for (var i = 0; i < subClasses.length; i++) {
                        if (subClasses[i] == relatedEntity) {
                            transform.appendChild(createArrow(targetPosition, sourcePosition, connectorColor, connectorSize, 1));
                        }
                    }
                    break;

				default :
					break;
            }
        } else {

        	if(hasCondition) {
                transform.appendChild(createConditionLine(sourcePosition, targetPosition, connectorColor, connectorSize, numberCalls));
			} else {
                transform.appendChild(createLine(sourcePosition, targetPosition, connectorColor, connectorSize, numberCalls));
            }
        }
		
		//config
		if(controllerConfig.createEndpoints){

                transform.appendChild(createEndPoint(sourcePosition, targetPosition, "0 0 0", connectorSize * 2));

		}
					
		return transform;
	}

	
	
	
	
	
	
	
	function calculateSourcePosition(entity, relatedEntity){
		
		var sourcePosition = getObjectPosition(entity.id);
		
		if(controllerConfig.sourceStartAtParentBorder){
			if(!isTargetChildOfSourceParent(relatedEntity, entity)){
				var targetPosition = getObjectPosition(relatedEntity.id);	
				if(targetPosition === null){
					return null;
				}	
				sourcePosition = calculatePositionFromParent(sourcePosition, targetPosition, entity.belongsTo);			
			}
		}	

		if(controllerConfig.sourceStartAtBorder){
			var targetPosition = getObjectPosition(relatedEntity.id);	
			if(targetPosition === null){
				return null;
			}
			sourcePosition = calculateBorderPosition(sourcePosition, targetPosition, entity);
		}
		
		return sourcePosition;		
	}
	
	function calculateTargetPosition(entity, relatedEntity){
		
		var targetPosition = getObjectPosition(relatedEntity.id);
		if(targetPosition === null){
			return null;
		}
		
		if(controllerConfig.targetEndAtParentBorder){
			if(!isTargetChildOfSourceParent(relatedEntity, entity)){				
				var sourcePosition = getObjectPosition(entity.id);		
				targetPosition = calculatePositionFromParent(targetPosition, sourcePosition, relatedEntity.belongsTo);			
			}
		}

		if(controllerConfig.targetEndAtBorder){
			var sourcePosition = getObjectPosition(entity.id);		
			targetPosition = calculateBorderPosition(targetPosition, sourcePosition, relatedEntity);	
		}
		
		return targetPosition;
	}
		
	function isTargetChildOfSourceParent(target, source){
		
		var targetParent = target.belongsTo;		
		var sourceParent = source.belongsTo;		
        
		while(targetParent !== undefined) {
			
			if(targetParent == sourceParent){
				return true;
			}	
			
			targetParent = targetParent.belongsTo;
		}  		
		
		return false;
	}	

	function calculateBorderPosition(sourcePosition, targetPosition, entity){
		
		if(!loadedMin.has(entity.id) || !loadedMax.has(entity.id)){
			events.log.error.publish({ text: "min max position for " + entity.id + " not loaded!" });
			return;
		}

		var min = loadedMin.get(entity.id);
		var max = loadedMax.get(entity.id);

		var sourcePosition = sourcePosition.slice();
		var targetPosition = targetPosition.slice();

		//calculate the 4 corner points
		var point00 = min.slice();
		var point01 = min.slice();
		var point10 = max.slice();
		var point11 = max.slice();

		point01[2] = max[2];
		point10[2] = min[2];

		//set y value of all points to delta y
		var deltaY = min[1] + (( max[1] - min[1]) / 2);
		point00[1] = deltaY;
		point01[1] = deltaY;
		point10[1] = deltaY;
		point11[1] = deltaY;

		sourcePosition[1] = deltaY;
		targetPosition[1] = deltaY;


		//calculate distances

		var distances = new Map();
		distances.set(calculateDistance(point00, targetPosition), point00);
		distances.set(calculateDistance(point01, targetPosition), point01);
		distances.set(calculateDistance(point10, targetPosition), point10);
		distances.set(calculateDistance(point11, targetPosition), point11);

		//get the two nearest points
		var sortedDistances =  Array.from(distances.keys());
		sortedDistances = sortedDistances.sort(function(a,b){return a-b});

		var nearestPoint1 = distances.get(sortedDistances[0]);
		var nearestPoint2 = distances.get(sortedDistances[1]);


		var valueUsedToCalculate;
		var valueToCalculate;
		if(nearestPoint1[0] === nearestPoint2[0]){
			valueUsedToCalculate = 0;
			valueToCalculate = 2;			
		} else if(nearestPoint1[2] === nearestPoint2[2]){
			valueUsedToCalculate = 2;
			valueToCalculate = 0;
		} else {
			events.log.error.publish({ text: "border points could not be calcuated" });
			return;
		}

		var riseVector = calculateDistanceVector(sourcePosition, targetPosition);


		if(riseVector[valueUsedToCalculate] == 0){
			var valueSwitch = valueUsedToCalculate;
			valueUsedToCalculate = valueToCalculate;
			valueToCalculate = valueSwitch;
		}

		var riseFactor = ( nearestPoint1[valueUsedToCalculate] - targetPosition[valueUsedToCalculate] ) / riseVector[valueUsedToCalculate];
	


		var borderPoint = new Array();
		borderPoint[valueUsedToCalculate] 	= nearestPoint1[valueUsedToCalculate];
		borderPoint[valueToCalculate] 		= targetPosition[valueToCalculate] + ( riseFactor * riseVector[valueToCalculate] );
		borderPoint[1] = deltaY;

		return borderPoint;
	}

	function calculateDistance(point1, point2){
		var distanceVector = calculateDistanceVector(point1, point2);
		return Math.sqrt( Math.pow(distanceVector[0], 2) + Math.pow(distanceVector[1], 2) + Math.pow(distanceVector[2], 2) );
	}

	function calculateDistanceVector(point1, point2){
		var distanceVector = new Array();
		distanceVector[0] = point1[0] - point2[0];
		distanceVector[1] = point1[1] - point2[1];
		distanceVector[2] = point1[2] - point2[2];

		return distanceVector;
	}
	
	
	function calculatePositionFromParent(sourcePosition, targetPosition, sourceParent){
		if(controllerConfig.elementShape == "circle"){
			return calculateCirclePositionFromParent(sourcePosition, targetPosition, sourceParent);
		}
		if(controllerConfig.elementShape == "square"){
			return calculateSquarePositionFromParent(sourcePosition, targetPosition, sourceParent);
		}
		return sourcePosition;
	}
	
	function calculateSquarePositionFromParent(sourcePosition, targetPosition, sourceParent){
		// To implement...
	}
	
	function calculateCirclePositionFromParent(sourcePosition, targetPosition, sourceParent){
		//calculation derived from http://www.3d-meier.de/tut6/XPresso53.html
		
		var parentPosition = getObjectPosition(sourceParent.id);
		
		var parentRadius = loadedDistances.get(sourceParent.id);
		var parentX = parentPosition[0];
		var parentY = parentPosition[1];
			
		
		var targetX = targetPosition[0];
		var targetY = targetPosition[1];
		
		var sourceX = sourcePosition[0];
		var sourceY = sourcePosition[1];
				
		var deltaX = targetX - sourceX;	
		var deltaY = targetY - sourceY;	
		
		var a = deltaY / deltaX;
		var b = (targetY - parentY) - ( a * (targetX - parentX) );
						
		var r = parentRadius[0];
		
		
		var AA = 1 + Math.pow(a, 2);
		var BB = (2 * a * b)
		var CC = Math.pow(b, 2) - Math.pow(r, 2);
				
		var XX = Math.pow(BB, 2) - 4 * AA * CC;
		 
		
		var x1 = (-BB + Math.sqrt( XX, 2 )) / ( 2 * AA );
		var x2 = (-BB - Math.sqrt( XX, 2 )) / ( 2 * AA );
		
		var y1 = a * x1 + b;
		var y2 = a * x2 + b;		
		
		
		var newSourcePosition;
		if(  	(targetY > sourceY && targetX < sourceX) ||
				(targetY < sourceY && targetX < sourceX) ){
			newSourcePosition	= [x2+parentX, y2+parentY, sourcePosition[2]];			
		} else {
			newSourcePosition	= [x1+parentX, y1+parentY, sourcePosition[2]];
		}
				
		return newSourcePosition;
	}

	
	
	function getObjectPosition(objectId){		
		
		var position = null;
		
		if( loadedPositions.has(objectId) ){			
			position = loadedPositions.get(objectId);
		} else {					
			var myElement = jQuery("#" + objectId)[0];
			if( myElement != undefined ){
				position = parseObjectPosition(myElement.getAttribute("translation"));
			}
		}	

		if( position === null){
			events.log.error.publish({ text: objectId + "has no position data" });
		}
		
		return position;		
	}
	
	function parseObjectPosition(positionString){
		
		var position = positionString.split(" ");
		
		for (var index = 0; index < position.length; ++index) {
			position[index] = parseFloat(position[index]);
		}
		
		return position;
	}

	
	
	
	function createEndPoint(source, target, color, size){
		//calculate attributes
		
		//endPointAngle
		var lineX = target[0]-source[0];
		var lineY = target[1]-source[1];
		
		var endPointAngle = Math.atan( Math.abs(lineY / lineX) ); 		

		//endPointAmount
		var lineAmount = Math.pow( lineX, 2) + Math.pow( lineY, 2);
		lineAmount = Math.sqrt(lineAmount,2);			

		var endPointAmount = lineAmount - 0.5;
		
		//endPoint positions
		var endPointX = Math.cos(endPointAngle) * endPointAmount;
		var endPointY = Math.sin(endPointAngle) * endPointAmount;
					
		if( lineX <= 0 && lineY >= 0){
			endPointX = endPointX * -1;
		}		
		if( lineX <= 0 && lineY <= 0){
			endPointX = endPointX * -1;
			endPointY = endPointY * -1;
		}		
		if( lineX >= 0 && lineY <= 0){
			endPointY = endPointY * -1;
		}
		
		var translation = [];	
				
		translation[0] = source[0] + endPointX;
		translation[1] = source[1] + endPointY;
		translation[2] = (source[2]+(target[2]-source[2])/2.0);	
		
		var scale = []; 
		scale[0] = size;
		scale[1] = 1;
		scale[2] = size;
		
		var rotation = [];
		rotation[0] = (target[2]-source[2]);
		rotation[1] = 0;
		rotation[2] = (-1.0)*(target[0]-source[0]);
		rotation[3] = Math.acos((target[1] - source[1])/(Math.sqrt( Math.pow(target[0] - source[0], 2) + Math.pow(target[1] - source[1], 2) + Math.pow(target[2] - source[2], 2) )));
		
		//create element
		var transform = document.createElement('Transform');
				
		transform.setAttribute("translation", translation.toString());
		transform.setAttribute("scale", scale.toString());
		transform.setAttribute("rotation", rotation.toString());
			
		var shape = document.createElement('Shape');
		transform.appendChild(shape);
		
		var appearance = document.createElement('Appearance');	
		shape.appendChild(appearance);
		var material = document.createElement('Material');	
		material.setAttribute("diffuseColor", color);
		appearance.appendChild(material);	
		
				
		var cylinder = document.createElement('Cylinder');
		cylinder.setAttribute("radius", "0.25");
		cylinder.setAttribute("height", "1");
		shape.appendChild(cylinder);
			
		return transform;	
	}
	
	
	
	function createLine(source, target, color, size, numberCalls){
		//calculate attributes
		
		var betrag = (Math.sqrt( Math.pow(target[0] - source[0], 2) + Math.pow(target[1] - source[1], 2) + Math.pow(target[2] - source[2], 2) ));
		var translation = [];	
		
		translation[0] = source[0]+(target[0]-source[0])/2.0;
		translation[1] = source[1]+(target[1]-source[1])/2.0;
		translation[2] = source[2]+(target[2]-source[2])/2.0;	
		
		var scale = []; 
		scale[0] = size;
		scale[1] = betrag;
		scale[2] = size;
		
		var rotation = [];
		rotation[0] = (target[2]-source[2]);
		rotation[1] = 0;
		rotation[2] = (-1.0)*(target[0]-source[0]);
		rotation[3] = Math.acos((target[1] - source[1])/(Math.sqrt( Math.pow(target[0] - source[0], 2) + Math.pow(target[1] - source[1], 2) + Math.pow(target[2] - source[2], 2) )));

        //create element
		var transform = document.createElement('Transform');
				
		transform.setAttribute("translation", translation.toString());
		transform.setAttribute("scale", scale.toString());
		transform.setAttribute("rotation", rotation.toString());
			
		var shape = document.createElement('Shape');
		transform.appendChild(shape);
		
		var appearance = document.createElement('Appearance');	
		shape.appendChild(appearance);
		var material = document.createElement('Material');	
		material.setAttribute("diffuseColor", color);
		appearance.appendChild(material);

		var numberOfCalls = 0.15 + (0.1 * numberCalls);
				
		var cylinder = document.createElement('Cylinder');
		cylinder.setAttribute("radius", numberOfCalls);
		cylinder.setAttribute("height", "1");

		shape.appendChild(cylinder);

		return transform;
	}

    function createConditionLine(source, target, color, size, numberCalls){
        //calculate attributes

        var betrag = (Math.sqrt( Math.pow(target[0] - source[0], 2) + Math.pow(target[1] - source[1], 2) + Math.pow(target[2] - source[2], 2) ));
        var translation = [];

        translation[0] = source[0]+(target[0]-source[0])/2.0;
        translation[1] = source[1]+(target[1]-source[1])/2.0;
        translation[2] = source[2]+(target[2]-source[2])/2.0;

        var scale = [];
        scale[0] = size;
        scale[1] = betrag;
        scale[2] = size;

        var rotation = [];
        rotation[0] = (target[2]-source[2]);
        rotation[1] = 0;
        rotation[2] = (-1.0)*(target[0]-source[0]);
        rotation[3] = Math.acos((target[1] - source[1])/(Math.sqrt( Math.pow(target[0] - source[0], 2) + Math.pow(target[1] - source[1], 2) + Math.pow(target[2] - source[2], 2) )));

        //create element
        var transform = document.createElement('Transform');

        transform.setAttribute("translation", translation.toString());
        transform.setAttribute("scale", scale.toString());
        transform.setAttribute("rotation", rotation.toString());

        var shape = document.createElement('Shape');
        transform.appendChild(shape);

        var appearance = document.createElement('Appearance');
        shape.appendChild(appearance);
        var material = document.createElement('Material');
        material.setAttribute("diffuseColor", color);
        appearance.appendChild(material);

        var numberOfCalls = 0.15 + (0.1 * numberCalls);

        var obj = document.createElement('Box');
        obj.setAttribute("size", "0.25 1 0.25");
       // obj.setAttribute("radius", numberOfCalls);
       // obj.setAttribute("height", "1");

        shape.appendChild(obj);

        return transform;
    }

	function createArrow(source, target, color, size, numbercalls) {
        //calculate attributes

        var betrag = (Math.sqrt( Math.pow(target[0] - source[0], 2) + Math.pow(target[1] - source[1], 2) + Math.pow(target[2] - source[2], 2) ));
        var translation = [];

        translation[0] = source[0]+(target[0]-source[0])/2.0;
        translation[1] = source[1]+(target[1]-source[1])/2.0;
        translation[2] = source[2]+(target[2]-source[2])/2.0;

        var scale = [];
        scale[0] = size;
        scale[1] = betrag;
        scale[2] = size;

        var rotation = [];
        rotation[0] = (target[2]-source[2]);
        rotation[1] = 0;
        rotation[2] = (-1.0)*(target[0]-source[0]);
        rotation[3] = Math.acos((target[1] - source[1])/(Math.sqrt( Math.pow(target[0] - source[0], 2) + Math.pow(target[1] - source[1], 2) + Math.pow(target[2] - source[2], 2) )));

        //create element
        var transform = document.createElement('Transform');

        transform.setAttribute("translation", translation.toString());
        transform.setAttribute("scale", scale.toString());
        transform.setAttribute("rotation", rotation.toString());

        var shape = document.createElement('Shape');
        transform.appendChild(shape);

        var appearance = document.createElement('Appearance');
        shape.appendChild(appearance);
        var material = document.createElement('Material');
        material.setAttribute("diffuseColor", color);
        appearance.appendChild(material);

        var shape2 = document.createElement('Shape');
        transform.appendChild(shape2);
        var appearance2 = document.createElement('Appearance');
        shape2.appendChild(appearance2);
        var material2 = document.createElement('Material');
        material2.setAttribute("diffuseColor", color);
        appearance2.appendChild(material2);

        //var callsLine = 0.15 + (0.1 * numbercalls);
        var calls = 1 + (numbercalls * 0.1);

        var cylinder = document.createElement('Cylinder');
        cylinder.setAttribute("radius", "0.25");
        cylinder.setAttribute("height", "1");

        shape.appendChild(cylinder);

        var cone = document.createElement('Cone');
        cone.setAttribute("bottomRadius", calls);
        cone.setAttribute("height", "0.1");


        shape2.appendChild(cone);

        /*var fontStyle = document.createElement("FontStyle");
        fontStyle.setAttribute("size", "0.1");

        var text = document.createElement("Text");
        //text.setAttribute("fontStyle", fontStyle);
        text.setAttribute("string", numbercalls);
        //cone.appendChild(text);

        //create incidence of calls
        var shape3 = document.createElement('Shape');
        transform.appendChild(shape3);
        var appearance3 = document.createElement('Appearance');
        shape3.appendChild(appearance3);
        var material3 = document.createElement('Material');
        material3.setAttribute("diffuseColor", "1 0 0");
        appearance3.appendChild(material3);

        shape3.appendChild(text);*/

        return transform;
    }

	

	return {
        initialize		: initialize,
		reset			: reset,
		activate		: activate,
		deactivate		: deactivate
    };    

}();