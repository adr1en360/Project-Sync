"""The HTTP routes, one module for each group of endpoints.

`main.py` holds the application and mounts each router here. A module in this
package holds the endpoints of one part of the flow, and also the helper functions
that only those endpoints use.

Each router has the prefix `/api/v1`. So the paths inside a module are short, and
the version of the API is in four places and not in eleven.
"""
