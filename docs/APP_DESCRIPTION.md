# Background
Orienteering competitions have weekly public events where anyone can attend. To register to those events, the competitor would have to go to the umpire where their name(and some other details including the Course number) would be added to the "start list", the competitor would pay and be given a map that they can use to compete.

# Current state
Currently the start list is a huge table printed out on multiple sheets paper for every event. It is already prefilled a bunch of competitors that regularily attend the competition so their full info wouldn't need to be taken every time (only course number would be written in those cases), but it also has empty lines at the very end to add one-off competitors.

In addition to the main competitors table, the printout also has additional tables of people. This is an optimization of the registration process. For example, some groups of students always arrive to competition using the same transportation method so they always arrive to the registration at the same time so it is quicker to have a separate list(a filter of sorts) of people like that so that the big main list wouldn't need to be searched for everyone separately.

# Plan for digitalization (MVP)
Have an universal desktop/mobile application that can work fully offline (since orienteering events may take place in locations with bad internet reception). Probably some universal web app to native app wrapper like Tauri.

The main view would be a scrollable table of regular competitors ordered by last name. The table would have somewhere to the side buttons for every letter of the alphabet to quickly scroll to competitors whose last name begins with given letter. In addition it would be good to fit some amount of custom filters(e.g. like the students) to some quick access location.

In addition to predefined regular competitors, there should be a search bar that allows to search from full list of competitors to register them also. The full list has around 200k competitors. The search should work with partial(prefix) last name matching and also every competitor has an unique competitor number(called EOL number) 

For every row, there should be some simple way to just mark the course number from predefined list for given competitor and it should display the price. Note that often competitors want to check in and register multiple people at the same time so it should be easy to calculate the total price of multiple recently registered people. Probably some list somewhere that fit the history of last 4 registered people (scrollable to see all) and their individual prices and additionally price of last 2, last 3, last 4 people summed together so no explicit selection needs to be made every time.

The application will probably be used by a device with touchscreen monitor in vertical orientation(10" fullhd) so the buttons/selections should be easily pressable by people with large fingers. Also the text should be easily readable by people with bad eyesight. Maybe an option somewhere to change the text size of table rows. The application may be used by people who are not very technologically competent. The application should strive to just be an enhanced version of the paper start list with the enchancements being the quick-jump to letter, full search, easy summing of people.

Every registration of competitor should be saved on the disk. Probably SQLite database.

All texts should be translatable strings as the users of the application will probably be in Estonia.

# Future additions

* Registration of brand new competitors - fields like
 - first name
 - last name
 - SportIdent card number
 - Date of birth
 - Club/Employer
 - email
* Searching by SportIdent - all competitors have a special device for timing their runs (SportIdent). This device is usually personalized so an USB reader could be used to quickly find that person in the competitors list based on their personal SportIdent card number
* Automatic two-way sync of data (remote management) - often the person that is handling the registrations is not the same person that manages the event itself so a separate web portal would be developed where the registration devices could be configured from (e.g. manage regualr competitors list, manage students filter) and the registration info would be automatically uploaded to that site for event manager to see
* Integration with banks - if internet reception is good at the event location, the POS terminal could be used to pay for the competitors
