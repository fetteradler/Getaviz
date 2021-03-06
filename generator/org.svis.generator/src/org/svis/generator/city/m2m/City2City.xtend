package org.svis.generator.city.m2m

import org.apache.commons.logging.LogFactory
import org.eclipse.emf.common.util.BasicEList
import org.eclipse.emf.ecore.resource.impl.ResourceImpl
import org.eclipse.emf.mwe.core.WorkflowContext
import org.eclipse.emf.mwe.core.issues.Issues
import org.eclipse.emf.mwe.core.lib.WorkflowComponentWithModelSlot
import org.eclipse.emf.mwe.core.monitor.ProgressMonitor
import org.eclipse.xtext.EcoreUtil2
import org.svis.generator.city.CitySettings
import org.svis.generator.city.CitySettings.Panels
import org.svis.generator.city.CitySettings.Bricks
import org.svis.generator.city.CityUtils
import org.svis.xtext.city.Building
import org.svis.xtext.city.BuildingSegment
import org.svis.xtext.city.District
import org.svis.xtext.city.Root
import org.svis.xtext.city.impl.CityFactoryImpl
import org.svis.generator.city.CitySettings.ClassElementsModes
import org.svis.generator.city.CitySettings.BuildingType
import org.svis.generator.city.CitySettings.OutputFormat

class City2City extends WorkflowComponentWithModelSlot {
	
	val cityFactory = new CityFactoryImpl()
	var RGBColor[] PCKG_colors
	var RGBColor[] NSP_colors
	var RGBColor[] NOS_colors
	var RGBColor[] CLSS_colors
	val log = LogFactory::getLog(class)
	
	override protected invokeInternal(WorkflowContext ctx, ProgressMonitor monitor, Issues issues){
		log.info("City2City has started.") 
		
		//receive input from CITY-slot
		val cityRoot = ctx.get("CITY") as Root
							
		val districts = EcoreUtil2::getAllContentsOfType(cityRoot, District)
		val buildings = EcoreUtil2::getAllContentsOfType(cityRoot, Building)
		
		if(!districts.empty) {
			if(CitySettings::BUILDING_TYPE == CitySettings::BuildingType::CITY_BRICKS
				|| CitySettings::BUILDING_TYPE == CitySettings::BuildingType::CITY_PANELS) {
				val buildingSegments = EcoreUtil2::getAllContentsOfType(cityRoot, BuildingSegment)	
				buildingSegments.forEach[setBuildingSegmentAttributes]
			}
			
			
			if(CitySettings::BUILDING_TYPE == BuildingType::CITY_DYNAMIC) {
				val NSP_maxLevel = districts.filter[type == "FAMIX.Namespace"].sortBy[-level].head.level	
				val CLSS_maxLevel = districts.filter[type == "FAMIX.Class"].sortBy[-level].head.level
				NSP_colors = createColorGradiant(CitySettings::DYNAMIC_PCKG_colorStart, CitySettings::DYNAMIC_PCKG_colorEnd, NSP_maxLevel)
				CLSS_colors = createColorGradiant(CitySettings::DYNAMIC_CLSS_colorStart, CitySettings::DYNAMIC_CLSS_colorEnd, CLSS_maxLevel)
			} else {
				val PCKG_maxLevel = districts.sortBy[-level].head.level
				PCKG_colors = createColorGradiant(CitySettings::PCKG_colorStart, CitySettings::PCKG_colorEnd, PCKG_maxLevel)
			}
			if(CitySettings::ORIGINAL_BuildingMetric == CitySettings::Original::BuildingMetric::NOS) {
				val NOS_max = buildings.sortBy[-numberOfStatements].head.numberOfStatements
				NOS_colors = createColorGradiant(CitySettings::CLSS_colorStart, CitySettings::CLSS_colorEnd, NOS_max + 1)
			}
			districts.forEach[setDistrictAttributes]
			buildings.forEach[setBuildingAttributes]
	
			CityLayout::cityLayout(cityRoot)
			switch(CitySettings::BUILDING_TYPE){
				case CITY_BRICKS:	BrickLayout.brickLayout(cityRoot) // Layout for buildingSegments
				case CITY_PANELS: 	buildings.forEach[setBuildingSegmentPositions(cityRoot)]
				case CITY_FLOOR: {
					buildings.forEach[calculateFloors]
					buildings.forEach[calculateChimneys]
				}
				default: {}//CityDebugUtils.infoEntities(cityRoot.document.entities, 0, true, true)	
			}		
		}
		ctx.set("CITYv2writer", cityRoot)

		//cityRoot enters slot, to be available for City2X3D-transformation
		var resource = new ResourceImpl()
		resource.contents += cityRoot
		ctx.set("CITYv2", resource)
		log.info("City2City has finished.")
	}
	
	def private RGBColor[] createColorGradiant(RGBColor start, RGBColor end, int maxLevel){
		var steps = maxLevel - 1
		if (maxLevel == 1) { steps++ } 
		val r_step = (end.r-start.r)/steps
		val g_step = (end.g-start.g)/steps
		val b_step = (end.b-start.b)/steps
		
		val colorRange = newArrayOfSize(maxLevel)
		for (i: 0 ..< maxLevel){ 
			val newR = start.r + i*r_step
			val newG = start.g + i*g_step
			val newB = start.b + i*b_step
			colorRange.set(i,new RGBColor(newR,newG,newB))
		}
		return colorRange
	}
	
	def private void setDistrictAttributes(District d) {
		d.height = CitySettings::HEIGHT_MIN
		if(CitySettings::BUILDING_TYPE == BuildingType::CITY_DYNAMIC) { 
			if(d.type == "FAMIX.Class") {
				d.color = CLSS_colors.get(d.level-1).asPercentage
			} else if( d.type == "FAMIX.Namespace") {
				d.color = NSP_colors.get(d.level-1).asPercentage
			}
		} else if(CitySettings::OUTPUT_FORMAT == OutputFormat::AFrame) { 
			d.color = CitySettings::PCKG_COLOR_HEX	
		} else {
			d.color = PCKG_colors.get(d.level-1).asPercentage
		}
	}
	
	def private setBuildingAttributes(Building b) {
		switch (CitySettings::BUILDING_TYPE) {
			case CITY_DYNAMIC,
			case CITY_ORIGINAL:	setBuildingAttributesOriginal(b)	
			case CITY_PANELS: 	setBuildingAttributesPanels(b)
			case CITY_BRICKS:   setBuildingAttributesBricks(b)
			case CITY_FLOOR:	setBuildingAttributesFloors(b)
		}		
		
	}
	
	def private setBuildingAttributesOriginal(Building b) {
		if (b.dataCounter == 0) {
			b.width = CitySettings::WIDTH_MIN
			b.length = CitySettings::WIDTH_MIN
		} else {
			b.width = b.dataCounter
			b.length = b.dataCounter
		}
		if (b.methodCounter == 0) {
			b.height = CitySettings::HEIGHT_MIN
		} else {
			b.height = b.methodCounter
		}

		//set counters to zero, to let them vanish in city2.xml (optional)
		b.dataCounter = 0
		b.data.clear
		b.methodCounter = 0
		b.methods.clear
		if(CitySettings::ORIGINAL_BuildingMetric == CitySettings::Original::BuildingMetric::NOS) {
			b.color = NOS_colors.get(b.numberOfStatements).asPercentage
		} else if(CitySettings::BUILDING_TYPE == BuildingType::CITY_DYNAMIC) {
			b.color = CitySettings::DYNAMIC_METHOD.asPercentage
		} else if (CitySettings::OUTPUT_FORMAT == OutputFormat::AFrame) {
			b.color = CitySettings::CLSS_COLOR_HEX
		} else {
			b.color = CitySettings::CLSS_color.asPercentage
		}		
	}
	
	def void setBuildingAttributesFloors(Building b){
		if (b.dataCounter < 2) { //pko 2016
			b.width = 2 // TODO in settings datei aufnehmen
			b.length = 2
		} else {
			b.width = Math.ceil(b.dataCounter / 4.0) + 1 		//pko 2016
			b.length = Math.ceil(b.dataCounter / 4.0) + 1		//pko 2016
		}
		
		if (b.methodCounter == 0) {
			b.height = CitySettings::HEIGHT_MIN
		} else {
			b.height = b.methodCounter
		}

		//set counters to zero, to let them vanish in city2.xml (optional)
		b.dataCounter = 0
		b.methodCounter = 0
		if (CitySettings::OUTPUT_FORMAT == OutputFormat::AFrame) {
			b.color = CitySettings::CLSS_COLOR_HEX
		} else {
			b.color = 53/255.0 + " " + 53/255.0 + " " + 89/255.0	//pko 2016
		}
	}
	
	def private setBuildingAttributesPanels(Building b) {
		if (CitySettings::SHOW_BUILDING_BASE) {
			b.height = CitySettings::HEIGHT_MIN
		} else {
			b.height = 0
		}	
		var int areaUnit = 1
		if (CitySettings::CLASS_ELEMENTS_MODE == ClassElementsModes::ATTRIBUTES_ONLY) {
			areaUnit = b.methodCounter
		} else {
			areaUnit = b.dataCounter
		}
		if (areaUnit <= 1) {
			b.width = CitySettings::WIDTH_MIN + Panels::PANEL_HORIZONTAL_MARGIN*2
			b.length = CitySettings::WIDTH_MIN + Panels::PANEL_HORIZONTAL_MARGIN*2
		} else {
			b.width = CitySettings::WIDTH_MIN*areaUnit + Panels::PANEL_HORIZONTAL_MARGIN*2
			b.length = CitySettings::WIDTH_MIN*areaUnit + Panels::PANEL_HORIZONTAL_MARGIN*2
		}
		if (CitySettings::OUTPUT_FORMAT == OutputFormat::AFrame) {
			b.color = CitySettings::CLSS_COLOR_HEX
		} else {			
			b.color = CitySettings::CLSS_color.asPercentage	
		}
	}
	
	def setBuildingAttributesBricks(Building b) {
		if (CitySettings::SHOW_BUILDING_BASE) {
			b.height = CitySettings::HEIGHT_MIN
		} else {
			b.height = 0
		}
		if (CitySettings::OUTPUT_FORMAT == OutputFormat::AFrame) {
			b.color = CitySettings::CLSS_COLOR_HEX
		} else {
			b.color = CitySettings::CLSS_color.asPercentage
		}
		// Setting width, height & sideCapacity
		switch (CitySettings::BRICK_LAYOUT) {
			case STRAIGHT: {
				b.sideCapacity = 1;
			}
			case BALANCED: {
				switch (CitySettings::CLASS_ELEMENTS_MODE) {
					case ATTRIBUTES_ONLY: b.sideCapacity = calculateSideCapacity(b.methodCounter)
					case METHODS_AND_ATTRIBUTES: b.sideCapacity = calculateSideCapacity(b.dataCounter+b.methodCounter)
					default: b.sideCapacity = calculateSideCapacity(b.dataCounter)
				}
			}
			case PROGRESSIVE: {
				switch (CitySettings::CLASS_ELEMENTS_MODE) {
					case METHODS_ONLY: b.sideCapacity = calculateSideCapacity(b.methodCounter)
					case METHODS_AND_ATTRIBUTES: b.sideCapacity = calculateSideCapacity(b.dataCounter+b.methodCounter)
					default: b.sideCapacity = calculateSideCapacity(b.dataCounter)
				}
			}
			default: {
				b.sideCapacity = 1;
			}
		}
		b.width = Bricks::BRICK_SIZE*b.sideCapacity
			+ Bricks::BRICK_HORIZONTAL_MARGIN*2
			+ Bricks::BRICK_HORIZONTAL_GAP*(b.sideCapacity-1)
		b.length = Bricks::BRICK_SIZE*b.sideCapacity
			+ Bricks::BRICK_HORIZONTAL_MARGIN*2
			+ Bricks::BRICK_HORIZONTAL_GAP*(b.sideCapacity-1)
			
	}
	
	// Calculates side capacity for progressive/balanced bricks layout
	def private int calculateSideCapacity(double value) {
		var sc = 0		// side capacity
		var lc = 0		// layer capacity
		var nolMin = 0	// number of layers
		var bcMin = 0	// building capacity min
		var bcMax = 0	// building capacity max

		do {
			sc++
			lc = sc * 4
			nolMin = sc * 2
			bcMin = lc * nolMin
			bcMax = bcMin - 1
		} while (bcMax < value)

		return sc;
	}
	
	def private void setBuildingSegmentAttributes(BuildingSegment bs) {
		switch(CitySettings::BUILDING_TYPE) {
			case CITY_PANELS:	setBuildingSegmentAttributesPanels(bs)
			case CITY_BRICKS:	setBuildingSegmentAttributesBricks(bs)
			default:{}
		}	
	}
	
	def private setBuildingSegmentAttributesPanels(BuildingSegment bs){
		// Test whether method or function, e.g. in case functional programming language was source
		//if (bs.parent.type.equals("FAMIX.Class") || bs.parent.type.equals("FAMIX.ParameterizableClass")) {
		val b = bs.parent as Building
		// Setting up base area
		var int areaUnit = 1
		if (CitySettings::CLASS_ELEMENTS_MODE == ClassElementsModes::ATTRIBUTES_ONLY) {
			areaUnit = b.methodCounter
		} else {			
			areaUnit = b.dataCounter
		}
		if (areaUnit <= 1) {
			bs.width = CitySettings::WIDTH_MIN
			bs.length = CitySettings::WIDTH_MIN
		} else {
			bs.width = CitySettings::WIDTH_MIN*areaUnit
			bs.length = CitySettings::WIDTH_MIN*areaUnit
		}
		//} else {
		//bs.width = Panels.PANEL_HEIGHT_UNIT
		//bs.length = Panels.PANEL_HEIGHT_UNIT
		//}
					
		// Setting up panel height
		var index = 0
		while (index < Panels::PANEL_HEIGHT_THRESHOLD_NOS.size
			&& bs.numberOfStatements >= Panels::PANEL_HEIGHT_THRESHOLD_NOS.get(index)) {
			index = index+1
		}
		bs.height = Panels::PANEL_HEIGHT_UNIT * (index+1)
					
		CityUtils.setBuildingSegmentColor(bs);	
	}
	
	def private setBuildingSegmentAttributesBricks(BuildingSegment bs){
		bs.width = Bricks::BRICK_SIZE
		bs.height = Bricks::BRICK_SIZE
		bs.length = Bricks::BRICK_SIZE

		CityUtils.setBuildingSegmentColor(bs);
	}
			
	def private void setBuildingSegmentPositions(Building b, Root cityRoot) {
		// Sorting elements
		val classElements = new BasicEList<BuildingSegment>()
		switch (CitySettings::CLASS_ELEMENTS_MODE) {
			case ATTRIBUTES_ONLY: classElements += b.data
			case METHODS_AND_ATTRIBUTES: {
				classElements += b.data
				classElements += b.methods
			}
			default: classElements += b.methods
		}
		CityUtils.sortBuildingSegments(classElements)

		// upper bound of the panel below the actual panel inside the loop
		var lowerBsPosY = b.position.y + b.height/2 + Panels::PANEL_VERTICAL_MARGIN

		// Correcting the initial gap on top of building depending on SeparatorMode
		if (CitySettings::PANEL_SEPARATOR_MODE == Panels::SeparatorModes::GAP
				|| CitySettings::PANEL_SEPARATOR_MODE == Panels::SeparatorModes::SEPARATOR)
			lowerBsPosY = lowerBsPosY - Panels::PANEL_VERTICAL_GAP
			//System.out.println("")
			// Looping through methods of building
			for (bs : classElements) {
			//System.out.println(bs.getType() + " " + bs.getValue() + " " + bs.getModifiers() + " " + bs.getNumberOfStatements());
				val bsPos = cityFactory.createPosition
				bsPos.x = b.position.x
				bsPos.z = b.position.z
				switch (CitySettings::PANEL_SEPARATOR_MODE) {
					case NONE: { // place segments on top of each other
						bsPos.y = lowerBsPosY + bs.height/2
						bs.position = bsPos
						lowerBsPosY = bsPos.y + bs.height/2
					}
					case GAP: { // Leave a free space between segments
						bsPos.y = lowerBsPosY + Panels::PANEL_VERTICAL_GAP + bs.height/2
						bs.position = bsPos
						lowerBsPosY = bsPos.y + bs.height/2
					}
					case SEPARATOR: { // Placing additional separators
						bsPos.y = lowerBsPosY + bs.height/2
						bs.position = bsPos

						// Placing a separator on top of the current method if it is not last method
						if (classElements.last != bs) {
							val sepPos = cityFactory.createPosition
							sepPos.x = b.position.x
							sepPos.y = bsPos.y + bs.height/2 + Panels::SEPARATOR_HEIGHT/2
							sepPos.z = b.position.z

						// Deciding which shape the separator has to have
							val nextElementType = classElements.get(classElements.indexOf(bs)+1).type
							if ((bs.type == "FAMIX.Method" && nextElementType == "FAMIX.Method")
								|| !CitySettings::SHOW_ATTRIBUTES_AS_CYLINDERS) {
								val panelSeparator = cityFactory.createPanelSeparatorBox
								panelSeparator.position = sepPos
								panelSeparator.width = bs.width
								panelSeparator.length = bs.length
								bs.separator += panelSeparator
							} else {
								val panelSeparator = cityFactory.createPanelSeparatorCylinder
								panelSeparator.position = sepPos
								panelSeparator.radius = bs.width/2
								bs.separator += panelSeparator
							}

							lowerBsPosY = sepPos.y + Panels::SEPARATOR_HEIGHT/2
					}
				}
			}
		}	
	}			
	
		//pko 2016
	def void calculateFloors(Building b){
		
		val cityFactory = new CityFactoryImpl
		
		val bHeight = b.height
		val bWidth = b.width
		val bLength = b.length
		
		val bPosX = b.position.x
		val bPosY = b.position.y
		val bPosZ = b.position.z
		
		val floors = b.methods
		val floorNumber = floors.length
		
		var floorCounter = 0
		
		for (floor : floors) {		
			floorCounter++
				
			floor.height 	= bHeight / ( floorNumber + 2 ) * 0.80
			floor.width 	= bWidth * 1.1
			floor.length 	= bLength * 1.1
		if (CitySettings::OUTPUT_FORMAT == OutputFormat::AFrame) {
			floor.color = "#1485CC"
		} else {
			floor.color		= 20/255.0 + " " + 133/255.0 + " " + 204/255.0
		}	
			floor.position = cityFactory.createPosition
			floor.position.x = 	bPosX
			floor.position.y = 	(bPosY - ( bHeight / 2) ) + bHeight / ( floorNumber + 2 ) * floorCounter  
			floor.position.z = 	bPosZ
			
			
		}
		
	}
	
	
	//pko 2016
	def void calculateChimneys(Building b){
			
		val cityFactory = new CityFactoryImpl
		
		val bHeight = b.height
		val bWidth = b.width
		//val bLength = b.length
		
		val bPosX = b.position.x
		val bPosY = b.position.y
		val bPosZ = b.position.z
		
		val chimneys = b.data
		//val chimneyNumber = chimneys.length
		
		var courner1 = newArrayList()
		var courner2 = newArrayList()
		var courner3 = newArrayList()
		var courner4 = newArrayList()
		
		var chimneyCounter = 0
		
		for(chimney : chimneys){
			
			chimney.height 	= 1
			chimney.width 	= 0.5 
			chimney.length 	= 0.5 
			
			if (CitySettings::OUTPUT_FORMAT == OutputFormat::AFrame) {
				chimney.color = "#FFFC19"
			} else {
				chimney.color		= 255/255.0 + " " + 252/255.0 + " " + 25/255.0
			}
			chimney.position = cityFactory.createPosition
			
			if(chimneyCounter % 4 == 0){
				courner1.add(chimney)
			}
			if(chimneyCounter % 4 == 1){
				courner2.add(chimney)
			}
			if(chimneyCounter % 4 == 2){
				courner3.add(chimney)
			}
			if(chimneyCounter % 4 == 3){
				courner4.add(chimney)
			}		
			chimneyCounter++	
		}
		
		chimneyCounter = 0
		for(chimney : courner1){
			chimney.position.x = 	(bPosX - ( bWidth / 2) ) + 0.5 + (1 * chimneyCounter)
			chimney.position.y = 	(bPosY + ( bHeight / 2) ) + 0.5
			chimney.position.z = 	(bPosZ - ( bWidth / 2) ) + 0.5 
			chimneyCounter++
		}
		
		chimneyCounter = 0
		for(chimney : courner2){
			chimney.position.x = 	(bPosX + ( bWidth / 2) ) - 0.5
			chimney.position.y = 	(bPosY + ( bHeight / 2) ) + 0.5
			chimney.position.z = 	(bPosZ - ( bWidth / 2) ) + 0.5  + (1 * chimneyCounter)
			chimneyCounter++
		}
		
		chimneyCounter = 0
		for(chimney : courner3){
			chimney.position.x = 	(bPosX + ( bWidth / 2) ) - 0.5 - (1 * chimneyCounter)
			chimney.position.y = 	(bPosY + ( bHeight / 2) ) + 0.5
			chimney.position.z = 	(bPosZ + ( bWidth / 2) ) - 0.5
			chimneyCounter++ 
		}
		
		chimneyCounter = 0
		for(chimney : courner4){
			chimney.position.x = 	(bPosX - ( bWidth / 2) ) + 0.5 
			chimney.position.y = 	(bPosY + ( bHeight / 2) ) + 0.5
			chimney.position.z = 	(bPosZ + ( bWidth / 2) ) - 0.5 - (1 * chimneyCounter)
			chimneyCounter++
		}
	}
}