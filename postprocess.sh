#!/bin/bash

jq '[
    .journeySolutionOption.journeyLegs | first | .journeyLegOptions[] | {
        "duration": .duration, 
        "acela": .isAcela, 
        "sold": .seatCapacityInfo.capacitySold, 
        "capacity": [
            .seatCapacityInfo.seatCapacityTravelClasses[] | {
                "class": .travelClass,
                "available": .availableInventory,
                "criticalCapacity": .criticalCapacity
            }
        ],
        "id": .id,
        "logicalId": .logicalId,
        "destArrival": .lastSegment.travelLeg.destination.schedule.arrivalDateTime,
        "originArrival": .lastSegment.travelLeg.origin.schedule.departureDateTime,
        "dest": .lastSegment.travelLeg.destination.code,
        "origin": .lastSegment.travelLeg.origin.code,
        "trainName": (.travelLegs | first | .travelService.name),
        "trainNumber": (.travelLegs | first | .travelService.number),
        "fares": [
            .reservableAccommodations[] | {
                "type": (.fareFamily), 
                "fare": .accommodationFare.dollarsAmount.total, 
                "class": .travelClass, 
                "category": .category,
                "inventory": (.travelLegAccommodations | first | .reservableProduct | {
                    "available": .availableInventory, 
                    "lowThreshold": .lowAvailabilityThreshold, 
                    "lowestThreshold": .lowestAvailabilityThreshold
                })
            }
        ]
    }
]' < /dev/stdin