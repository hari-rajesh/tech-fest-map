import React, { useEffect, useRef, useState } from 'react';
import {venues} from './utils/Venues.jsx'
import {Departments} from './utils/Departments.jsx'
import StyledVenueTable from './StyledVenueTable.jsx';
export const CustomGoogleMap = () => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const currentLocationMarkerRef = useRef(null);
  const infoWindowsRef = useRef([]);
  const [initialLocationSet, setInitialLocationSet] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Group venues by floor for better organization
  const getVenuesByDepartmentAndFloor = (departmentName) => {
    const filteredVenues = Venues.filter(venue => 
      venue.department === departmentName
    );
    
    // Group by floor
    const groupedByFloor = {};
    filteredVenues.forEach(venue => {
      if (!groupedByFloor[venue.floor]) {
        groupedByFloor[venue.floor] = [];
      }
      groupedByFloor[venue.floor].push(venue);
    });
    
    return groupedByFloor;
  };

  // Remove userLocation from dependency array to prevent reinitializing
  useEffect(() => {
    const initMap = () => {
      // Campus boundary coordinates
      const boundaryCoords = [
        { lat: 9.150050, lng: 77.830462 }, // Top Left
        { lat: 9.148119, lng: 77.834707 }, // Top Right
        { lat: 9.150166, lng: 77.833030 }, // Top center
        { lat: 9.146250, lng: 77.832484 }, // Bottom Right
        { lat: 9.148910, lng: 77.826296 }, // Bottom Left
      ];

      // Calculate center point of boundary
      const center = {
        lat: (Math.max(...boundaryCoords.map(c => c.lat)) + Math.min(...boundaryCoords.map(c => c.lat))) / 2,
        lng: (Math.max(...boundaryCoords.map(c => c.lng)) + Math.min(...boundaryCoords.map(c => c.lng))) / 2
      };

      // Create map container with square shape
      const mapContainer = mapRef.current;
      mapContainer.style.borderRadius = '0';
      mapContainer.style.overflow = 'hidden';

      // Calculate initial zoom level to fit boundary
      const bounds = new window.google.maps.LatLngBounds();
      boundaryCoords.forEach(coord => bounds.extend(coord));

      // Create the map with updated options
      const map = new window.google.maps.Map(mapContainer, {
        center: center,
        zoom: 10,
        mapTypeId: 'satellite',
        fullscreenControl: false,
        streetViewControl: false,
        mapTypeControl: false, 
        zoomControl: false,
        rotateControl: false,
        heading: 0,
        tilt: 45,
        gestureHandling: 'greedy',
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'on' }]
          },
          // Custom styling to complement gradient theme
          {
            featureType: 'water',
            elementType: 'geometry',
            stylers: [{ color: '#4682B4' }]
          },
          {
            featureType: 'landscape',
            elementType: 'geometry',
            stylers: [{ color: '#E8E8E8' }]
          }
        ],
        restriction: {
          latLngBounds: {
            north: bounds.getNorthEast().lat() + 0.001,
            south: bounds.getSouthWest().lat() - 0.001,
            east: bounds.getNorthEast().lng() + 0.001,
            west: bounds.getSouthWest().lng() - 0.001
          },
          strictBounds: true
        }
      });

      // Fit map to boundary with padding
      map.fitBounds(bounds, {
        top: 50,
        right: 100,
        bottom: 50,
        left: 100
      });

      mapInstanceRef.current = map;

      // Add initial current location marker
      if (navigator.geolocation) {
        const locationMarker = new window.google.maps.Marker({
          map: map,
          title: 'You are here',
          icon: {
            path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 8,
            fillColor: '#4285F4',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
            rotation: 0
          },
          zIndex: 9999,
          optimized: false
        });
        currentLocationMarkerRef.current = locationMarker;

        // Get initial position and start watching
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const pos = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            locationMarker.setPosition(pos);
            map.setCenter(pos);
            map.setZoom(18);
            setUserLocation(pos);

            // Watch for location updates
            navigator.geolocation.watchPosition(
              (newPosition) => {
                const newPos = {
                  lat: newPosition.coords.latitude,
                  lng: newPosition.coords.longitude
                };
                locationMarker.setPosition(newPos);
                setUserLocation(newPos);

                // Update arrow rotation if heading is available
                if (newPosition.coords.heading !== null) {
                  const icon = locationMarker.getIcon();
                  icon.rotation = newPosition.coords.heading;
                  locationMarker.setIcon(icon);
                }
              },
              null,
              { 
                enableHighAccuracy: true,
                maximumAge: 0
              }
            );
          },
          (error) => {
            console.error('Error getting location:', error);
            alert('Please enable location services to see your position');
          },
          {
            enableHighAccuracy: true,
            maximumAge: 0
          }
        );
      }

      // Setup directions renderer with updated path styling
      const directionsRenderer = new window.google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: '#4285F4',
          strokeWeight: 8,
          strokeOpacity: 0.8
        }
      });
      directionsRendererRef.current = directionsRenderer;

      // Function to get icon based on category
      const getIconForCategory = (category) => {
        const iconBase = 'https://maps.google.com/mapfiles/ms/icons/';
        switch (category) {
          case 'academic':
            return {
              url: `/school.png`,
              scaledSize: new window.google.maps.Size(40, 40),
              labelOrigin: new window.google.maps.Point(15, -10)
            };
          case 'hostel':
            return {
              url: `/hostel1.png`,
              scaledSize: new window.google.maps.Size(45, 45),
              labelOrigin: new window.google.maps.Point(15, -10)
            };
          case 'facility':
            return {
              url: `/library.png`,
              scaledSize: new window.google.maps.Size(40, 40),
              labelOrigin: new window.google.maps.Point(15, -10)
            };
          case 'entrance':
            return {
              url: `/entry.png`,
              scaledSize: new window.google.maps.Size(40, 40),
              labelOrigin: new window.google.maps.Point(15, -10)
            };
          default:
            return {
              url: `/restaurant.png`,
              scaledSize: new window.google.maps.Size(40, 40),
              labelOrigin: new window.google.maps.Point(15, -10)
            };
        }
      };

      // Function to get department label
      const getDepartmentLabel = (name, category) => {
        if (category === 'academic') {
          if (name.includes('CSE')) return 'CSE';
          if (name.includes('IT')) return 'IT';
          if (name.includes('ECE')) return 'ECE';
          if (name.includes('EEE')) return 'EEE';
          if (name.includes('AIDS')) return 'AIDS';
          if (name.includes('S&H')) return 'S&H';
          if (name.includes('Mechanical')) return 'MECH';
          if (name.includes('Civil')) return 'CIVIL';
        } else if (category === 'hostel') {

          if (name.includes('BOYS HOSTEL 1')) return 'Boys Hostel 1';
          if(name.includes('BOYS HOSTEL 2')) return 'Boys Hostel 2';

          if (name.includes('Boys Hostel 1')) return 'Boys Hostel 1';
          if(name.includes('Boys Hostel 2')) return 'Boys Hostel 2';

          if (name.includes('Girls')) return 'Girls Hostel';
        } else if (category === 'facility') {
          return 'Library';
        }
        else if (category === 'entrance') {
            return 'Entrance';
          
        } else if (category === 'canteen') {
          return 'Canteen';
        }
        return '';
      };

      // Add locations with categories and descriptions
      const departments = Departments;
      // Function to close all info windows
      const closeAllInfoWindows = () => {
        infoWindowsRef.current.forEach(window => window.close());
      };

      // No more click listener for coordinates display as requested by user
      
      departments.forEach(dept => {
        const marker = new window.google.maps.Marker({
          position: dept.position,
          map: map,
          title: dept.name,
          icon: getIconForCategory(dept.category),
          label: {
            text: getDepartmentLabel(dept.name, dept.category),
            color: '#FFFFFF',
            fontSize: '12px',
            fontWeight: 'bold',
            className: 'marker-label'
          }
        });
        const infowindow = new window.google.maps.InfoWindow({
          disableAutoPan: false,
          maxWidth: 220,
          pixelOffset: new window.google.maps.Size(0, -25), // Significant upward adjustment
          content: `
            <div style="padding: 0; margin: 0; background-color: #21013c; color: white; border-radius: 4px; overflow: hidden; border: 2px solid #3a0066;">
              <div style="padding: 5px; margin: 0;">
                <h3 style="font-weight: bold; margin: 0; color: white; font-size: 13px; line-height: 1.1;">${dept.name}</h3>
                <p style="margin: 2px 0 4px 0; color: #e0e0e0; font-size: 10px; line-height: 1.1;">${dept.description}</p>
                <div style="display: grid; grid-template-columns: ${dept.category === 'academic' ? '1fr 1fr' : '1fr'}; gap: 4px; margin: 0;">
                  <button 
                    onclick="window.showRoute(${dept.position.lat}, ${dept.position.lng})"
                    style="
                      background: #1a73e8;
                      color: white;
                      border: none;
                      padding: 4px 0;
                      border-radius: 8px;
                      cursor: pointer;
                      font-weight: bold;
                      font-size: 11px;
                      width: 100%;
                      line-height: 1;
                      height: 24px;
                      text-align: center;
                      white-space: nowrap;
                      overflow: hidden;
                      text-overflow: ellipsis;
                    "
                  >
                   Show Path
                  </button>
                  ${dept.category === 'academic' ? `
                  <button 
                    onclick="window.showDetails('${dept.name}')"
                    style="
                      background: #1a73e8;
                      color: white;
                      border: none;
                      padding: 4px 0;
                      border-radius: 8px;
                      cursor: pointer;
                      font-weight: bold;
                      font-size: 11px;
                      width: 100%;
                      line-height: 1;
                      height: 24px;
                      text-align: center;
                      white-space: nowrap;
                      overflow: hidden;
                      text-overflow: ellipsis;
                    "
                  >
                    Details
                  </button>` : ''}
                </div>
              </div>
            </div>
          `
        });
        
        // Add comprehensive styles for both desktop and mobile
        const style = document.createElement('style');
        style.textContent = `
          /* Remove all extra spacing */
          .gm-style .gm-style-iw-c {
            padding: 0 !important;
            border: 2px solid #3a0066 !important;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4) !important;
            border-radius: 4px !important;
            background-color: #21013c !important;
            transform: translate(-50%, -50%) !important; /* Center vertically and horizontally */
            top: 50% !important;
            left: 50% !important;
            margin: 0 !important;
            position: absolute !important;
          }
          
          /* Remove scrolling and padding from content area */
          .gm-style .gm-style-iw-d {
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            max-height: none !important;
          }
          
          /* Hide arrow */
          .gm-style .gm-style-iw-t::after,
          .gm-style-iw-tc {
            display: none !important;
          }
          
          /* Style close button */
          .gm-style .gm-ui-hover-effect {
            top: 0 !important;
            right: 0 !important;
            opacity: 1 !important;
          
          }
 
          
          /* Remove any extra container padding */
          .gm-style-iw-a, .gm-style-iw-t {
            padding: 0 !important;
            margin: 0 !important;
            position: absolute !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
          }
          
          /* Button text should always be on a single line */
          .gm-style .gm-style-iw-c button {
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            letter-spacing: -0.2px !important;
          }
          
          /* Adjust for mobile */
          @media (max-width: 768px) {
            .gm-style .gm-style-iw-c {
              max-width: 200px !important;
            }
            
            .gm-style .gm-ui-hover-effect {
              width: 20px !important;
              height: 20px !important;
            }
            
            /* Smaller font size for buttons on mobile */
            .gm-style .gm-style-iw-c button {
              font-size: 9px !important;
              height: 22px !important;
              padding: 0 !important;
              letter-spacing: -0.3px !important;
            }
          }
        `;
        document.head.appendChild(style);
        
        // Apply additional adjustments when InfoWindow opens
        google.maps.event.addListener(infowindow, 'domready', function() {
          // Force white color on close button
          document.querySelectorAll('.gm-ui-hover-effect img').forEach(img => {
            img.style.filter = 'brightness(0) invert(1)';
          });
          
          // Force center position
          document.querySelectorAll('.gm-style-iw').forEach(el => {
            el.style.position = 'absolute';
            el.style.top = '50%';
            el.style.left = '50%';
            el.style.transform = 'translate(-50%, -50%)';
          });
          
          // Remove any hidden overflow
          document.querySelectorAll('.gm-style-iw-d').forEach(el => {
            el.style.overflow = 'visible';
            el.style.maxHeight = 'none';
          });
          document.querySelectorAll('.gm-ui-hover-effect img').forEach(img => {
            img.style.filter = 'brightness(0) invert(1)';
          });
          
          // Ensure buttons are properly sized and text stays on one line
          document.querySelectorAll('button').forEach(btn => {
            if (btn.innerText === 'Show Path' || btn.innerText === 'Details') {
              btn.style.minHeight = '22px';
              // Smaller font size for mobile
              btn.style.fontSize = window.innerWidth < 768 ? '9px' : '12px';
              btn.style.fontWeight = 'bold';
              btn.style.whiteSpace = 'nowrap';
              btn.style.overflow = 'hidden';
              btn.style.textOverflow = 'ellipsis';
              btn.style.letterSpacing = window.innerWidth < 768 ? '-0.3px' : 'normal';
            }
          });
        });
        
        infoWindowsRef.current.push(infowindow);
        
        // Update the marker click listener to center the InfoWindow
        marker.addListener('click', () => {
          // Close all other info windows first
          closeAllInfoWindows();
          
          // Center the map on the marker
          const markerPosition = marker.getPosition();
          map.setCenter(markerPosition);
          
          // Open the InfoWindow in the center of the map (not at marker position)
          infowindow.setPosition(map.getCenter());
          infowindow.open(map);
        });
        // Add click listener to close InfoWindow when clicking outside
        map.addListener('click', () => {
          closeAllInfoWindows();
        });
      });

      // Function to show route with real-time updates
      window.showRoute = async (destLat, destLng) => {
        closeAllInfoWindows();
        setIsLoading(true); // Show loading spinner
        
        if (!navigator.geolocation) {
          setIsLoading(false);
          alert("Geolocation is not supported by your browser");
          return;
        }
      
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              maximumAge: 0
            });
          });
      
          const currentLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
      
          const directionsService = new window.google.maps.DirectionsService();
          const destination = { lat: destLat, lng: destLng };
      
          directionsService.route({
            origin: currentLocation,
            destination: destination,
            travelMode: 'WALKING'
          }, (response, status) => {
            setIsLoading(false); // Hide loading spinner
            if (status === 'OK' && directionsRendererRef.current) {
              directionsRendererRef.current.setDirections(response);
              
              const targetDept = departments.find(dept => 
                Math.abs(dept.position.lat - destLat) < 0.0001 && 
                Math.abs(dept.position.lng - destLng) < 0.0001
              );
              
              if (targetDept) {
                setSelectedDepartment(targetDept);
                if (targetDept.category === 'academic') {
                  setShowDetails(true);
                }
              }
            } else {
              console.error('Directions request failed due to ' + status);
              alert('Unable to calculate route. Please try again.');
            }
            setIsGettingLocation(false);
          });
        } catch (error) {
          setIsLoading(false); // Hide loading spinner on error
          console.error('Error getting location:', error);
          alert('Please enable location access and try again');
          setIsGettingLocation(false);
        }
      };

      // Function to show details
      window.showDetails = (departmentName) => {
        // Close all info windows first
        closeAllInfoWindows();
        
        const department = departments.find(dept => dept.name === departmentName);
        if (department) {
          setSelectedDepartment(department);
          setShowDetails(true);
          
          // Scroll to venue section with smooth animation
          setTimeout(() => {
            const venueSection = document.querySelector('.venue-info');
            if (venueSection) {
              venueSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 100); // Reduced delay for faster scrolling
        }
      };

      // Watch user location without auto-centering the map
      if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
          (position) => {
            const pos = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };

            // Update user location state for path calculation
            setUserLocation(pos);

            // Create or update current location marker
            if (!currentLocationMarkerRef.current) {
              currentLocationMarkerRef.current = new window.google.maps.Marker({
                position: pos,
                map: mapInstanceRef.current,
                title: 'You are here',
                icon: {
                  path: window.google.maps.SymbolPath.CIRCLE,
                  fillColor: '#4285F4',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2,
                  scale: 12
                },
                zIndex: 999
              });
            } else {
              currentLocationMarkerRef.current.setPosition(pos);
            }

            // Remove the auto-centering logic
            // Only set center once when location is first obtained
            if (!initialLocationSet) {
              setInitialLocationSet(true);
              mapInstanceRef.current.setCenter(pos);
              mapInstanceRef.current.setZoom(15);
            }
          },
          (error) => console.error('Error watching position:', error),
          {
            enableHighAccuracy: true,
            maximumAge: 0
          }
        );
      }
    };

    // Simplified script loading and map initialization
    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
      script.async = true;
      script.onload = initMap;
      document.head.appendChild(script);
    } else {
      initMap();
    }

    // Clean up function
    return () => {
      if (window.google && mapInstanceRef.current) {
        window.google.maps.event.clearInstanceListeners(mapInstanceRef.current);
      }
      if (currentLocationMarkerRef.current) {
        currentLocationMarkerRef.current.setMap(null);
      }
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
      }
      // Clear global functions
      delete window.showRoute;
      delete window.showDetails;
    };
  }, []); // Empty dependency array to run only once

  // Enhanced "Move to Current Location" button with better performance
  const handleMoveToCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          
          // Remove existing marker if any
          if (currentLocationMarkerRef.current) {
            currentLocationMarkerRef.current.setMap(null);
          }

          // Create new marker at current location
          currentLocationMarkerRef.current = new window.google.maps.Marker({
            position: pos,
            map: mapInstanceRef.current,
            title: 'You are here',
            icon: {
              path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 8,
              fillColor: '#4285F4',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 2,
              rotation: position.coords.heading || 0
            },
            zIndex: 9999,
            optimized: false
          });

          if (mapInstanceRef.current) {
            mapInstanceRef.current.setCenter(pos);
            mapInstanceRef.current.setZoom(15);
          }
        },
        (error) => {
          console.error('Location error:', error);
          alert('Please enable location access to see your position on the map');
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0
        }
      );
    } else {
      alert('Geolocation is not supported by this browser');
    }
  };

  // Venues data organized by department
  const Venues = venues;
  // Convert venues to organized structure by floor for the selected department
  const organizedVenues = selectedDepartment 
    ? getVenuesByDepartmentAndFloor(selectedDepartment.name) 
    : {};

  return (
    <div className="flex flex-col items-center w-full min-h-screen overflow-y-auto pb-8" style={{
      background: 'linear-gradient(135deg, #21013c, #2d024f, #2b024b, #1f0139, #0e001e, #0b001a, #300552, #300254, #310255, #0a0018)',
      fontFamily: 'Poppins, sans-serif',
      color: '#ffffff',
    }}>
      <h2 className="text-2xl font-bold my-2 text-white text-center">NEC Campus Compass</h2>
      
      {/* Map container with synchronized loader */}
      <div className="w-full flex justify-center items-center px-4 sm:px-0"> 
        <div className="relative w-full max-w-[500px]">
          <div 
            ref={mapRef} 
            className="w-full h-[80vw] max-w-[500px] max-h-[500px] relative m-auto mb-2"
            style={{ 
              borderRadius: '0',
              padding: '0',
              animation: isLoading ? 'none' : 'pulse 2s infinite',
            }} 
          />
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-purple-900/40 backdrop-blur-sm animate-breath">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin" />
                <p className="mt-2 text-white text-sm font-medium animate-pulse">Finding path...</p>
              </div>
            </div>
          )}
        </div>
      </div>
        
        {/* Animation styles with improved media queries */}
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');

          /* Add responsive styles for the map container */
          @media (min-width: 1024px) {
            [ref="mapRef"] {
              height: 60vh !important;
              width: 60vw !important;
              max-width: 800px !important;
              max-height: 600px !important;
            }
          }

          @keyframes pulse {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(49, 2, 85, 0.7); }
            50% { transform: scale(1.02); box-shadow: 0 0 0 10px rgba(49, 2, 85, 0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(49, 2, 85, 0); }
          }
          
          @keyframes fadeIn {
            0% { opacity: 0; }
            100% { opacity: 1; }
          }
          
          @keyframes slideIn {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          
          .animate-fadeIn {
            animation: fadeIn 0.5s ease-out forwards;
          }
          
          .animate-slideIn {
            animation: slideIn 0.5s ease-out forwards;
          }
          
          @media (max-width: 768px) {
            h2 {
              font-size: 1.25rem !important;
              margin: 0.5rem 0 !important;
            }
            
            button {
              font-size: 0.875rem !important;
              padding: 0.5rem 0.875rem !important;
              margin-top: 0.5rem !important;
            }
            
            .venue-info {
              padding: 0.5rem !important;
            }
            
            .venue-table th,
            .venue-table td {
              padding: 0.25rem 0.5rem !important;
              font-size: 0.875rem !important;
            }
          }
          
          /* For very small screens */
          @media (max-width: 480px) {
            h2 {
              font-size: 1rem !important;
            }
            
            .map-helper-text {
              font-size: 0.75rem !important;
              padding: 0.5rem !important;
              margin-top: 0.25rem !important;
            }
          }

          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }

          @keyframes breath {
            0% { opacity: 0.6; backdrop-filter: blur(2px); }
            50% { opacity: 0.8; backdrop-filter: blur(4px); }
            100% { opacity: 0.6; backdrop-filter: blur(2px); }
          }

          .animate-breath {
            animation: breath 2s ease-in-out infinite;
          }
        `}
      </style>
      
      {/* Move to Current Location button removed as requested */}
      
      {/* Helper text - more compact */}
      <div className="mt-2 p-2 rounded-lg text-center w-full max-w-md map-helper-text" 
        style={{
          background: 'rgba(33, 1, 60, 0.7)',
          color: 'white',
          borderRadius: '10px',
          backdropFilter: 'blur(5px)',
          fontSize: '0.9rem'
        }}>
        <p>Zoom and pan to explore. Click markers for walking paths.</p>
      </div>
      
   {/* Venue details table with enhanced styling and floor grouping - improved for mobile and PC */}
{showDetails && selectedDepartment && selectedDepartment.category === 'academic' && (
  <div className="mt-4 p-4 rounded-lg w-full max-w-4xl venue-table venue-info animate-fadeIn"
    style={{
      background: 'rgba(33, 1, 60, 0.9)',
      color: 'white',
      borderRadius: '15px',
      backdropFilter: 'blur(8px)',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
      marginBottom: '1.5rem',
      transition: 'all 0.3s ease-in-out',
      animation: 'fadeIn 0.5s ease-out',
      border: '2px solid rgba(156, 39, 176, 0.3)',
      maxHeight: 'none',
      height: 'auto'
    }}>
    <h3 className="text-2xl font-bold mb-4 text-center" 
      style={{
        background: 'linear-gradient(90deg, #9c27b0, #673ab7)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        textShadow: '0 2px 4px rgba(0,0,0,0.3)'
      }}>
      {selectedDepartment.name} Events
    </h3>
    <div className="text-center mb-3 text-purple-200 text-sm">
      <p>Below are all events happening in {selectedDepartment.name}</p>
    </div>
    
    {/* Filter events for the selected department */}
    {(() => {
      // Get department name without "Block" for matching
      const deptName = selectedDepartment.name.replace(/\s+Department$/, '');
      
      // Filter events for this department
      const departmentEvents = venues.filter(event => 
        event.department.includes(deptName)
      );
      
      // Organize by floor
      const eventsByFloor = {};
      departmentEvents.forEach(event => {
        if (!event.floor || event.floor === 'Unknown') {
          if (!eventsByFloor['Other Locations']) {
            eventsByFloor['Other Locations'] = [];
          }
          eventsByFloor['Other Locations'].push(event);
        } else {
          if (!eventsByFloor[event.floor]) {
            eventsByFloor[event.floor] = [];
          }
          eventsByFloor[event.floor].push(event);
        }
      });
      
      // Return the JSX
      return Object.keys(eventsByFloor).sort((a, b) => {
        // Sort floors in logical order: Ground Floor, First Floor, Second Floor, etc.
        const floorOrder = {
          'Ground Floor': 1,
          'First Floor': 2,
          'Second Floor': 3,
          'Third Floor': 4,
          'Other Locations': 5
        };
        return floorOrder[a] - floorOrder[b];
      }).map((floor, floorIndex) => (
        <div key={floorIndex} className="mb-5 animate-slideIn" 
          style={{
            animation: `slideIn 0.3s ease-out forwards ${0.1 + (floorIndex * 0.1)}s`,
            opacity: 0,
            transform: 'translateY(20px)'
          }}>
          <h4 className="text-lg font-semibold mb-2 pl-2 border-l-4 border-purple-500"
            style={{
              background: 'linear-gradient(90deg, #673ab7, #9c27b0)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 1px 2px rgba(0,0,0,0.2)'
            }}>
            {floor}
          </h4>
          
          {/* Use StyledVenueTable component with the events for this floor */}
          <StyledVenueTable venues={eventsByFloor[floor]} />
        </div>
      ));
    })()}
  </div>
)}
    </div>
  );
};