/*
 * Drink Web Interface
 *
 * Copyright 2008 Dan Willemsen
 * Licensed under the MIT (MIT-LICENSE.txt) license
 */

$.ui.tabs.getter += " idx ui";
$.extend($.ui.tabs.prototype, {
    idx: function(str) {
        return this.$tabs.index( this.$tabs.filter('[href$=' + str + ']').eq(0) );
    }
});
$.fn.extend({
    unfocusColor: function(str, unColor, color) {
        $(this).focus(function() {
            var self = $(this);
            if(this.value == str)
                self.val('');
            self.css('color', color);
        }).blur(function() {
            var self = $(this);
            if(this.value == '')
                self.css('color', unColor).val(str);
        }).each(function() {
            var self = $(this);
            if(this.value != str)
                self.css('color', color);
            else
                self.css('color', unColor);
        });
    }
});

$(document).ready(function() {
    drink.user.init();
    
    startEventListening();
});

function startEventListening() {
    return;
    var xhr = new XMLHttpRequest();
    if(typeof xhr.multipart != "undefined") {
        $("body").append("xhr multipart");
        xhr.multipart = true;
        xhr.open('GET', '/drink/events', true);
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        xhr.onload = function(event) {
            alert(event.target.responseText);
        };
        xhr.send(null);
    }
    // $.ajax({
    //     dataType: 'json',
    //     url: '/drink/events',
    //     multipart: true,
    //     error: function() {
    //         alert("Error listening for events");
    //     },
    //     success: function(data, status) {
    //         alert("Got data: " + data);
    //     }
    // });
}

drink = {}

drink.ajax = function(options, fn) {
    var errFn = false;
    if(arguments.length > 2)
        errFn = arguments[2];

    options.dataType = 'json';
    options.error = function() {
        drink.log("Error fetching " + options.url);
        if(errFn != false)
            errFn.apply(null, null);
    }
    options.success = function(data, status) {
        if(data.status == "error") {
            drink.log("Error returned from " + options.url + " - " + data.reason);
            if(errFn != false)
                errFn.apply(null, [data.reason]);
        } else {
            fn.apply(null, [data.data]);
        }
    }
    $.ajax(options);
}

drink.log = function(str) {
    if(window.console && console.log)
        console.log(str);
//    else
//        alert(str);
}

drink.time = {
    tz_offset: (new Date()).getTimezoneOffset() * 60,
    
    nowUTC: function() {
        return Math.floor((new Date()).getTime() / 1000);
    },
    
    fromUTC: function(val) {
        var time = new Date();
        time.setTime(val * 1000);
        return time;
    },
    
    today: function() {
        return new Date().toDateString();
    },
    
    yesterday: function() {
        var yesterday = new Date();
        yesterday.setTime(yesterday.getTime() - 86400000);
        return yesterday.toDateString();
    },
    
    prettyDateTime: function(t) {
        var timeStr = t.toDateString();
        
        if(timeStr == drink.time.today()) {
            return $.strftime("Today %H:%M:%S", t, false);
        } else if(timeStr == drink.time.yesterday()) {
            return $.strftime("Yesterday %H:%M:%S", t, false);
        }
        
        return $.strftime("%m/%d/%Y %H:%M:%S", t, false);
    }
}

drink.user = new (function() {
    var self = this;
    var current_user = false;
    
    var gotUser = function(data) {
        // Refresh page if user changed
        if(current_user && data.username != current_user.username)
            location.reload();
        
        current_user = data;
        
        $('#currentuser').text(current_user.username);
        $('#currentuser_balance').text(current_user.credits);
        if(current_user.admin)
            $('#currentuser_admin').show();
        else
            $('#currentuser_admin').hide();
    }
    
    this.refresh = function() {
        drink.ajax({
            url: '/drink/currentuser'
        }, gotUser, function() {
            drink.log("Error getting current user");
            // Refresh the page, hopefully making the user re-webauth if necessary
            location.reload(true);
        });
    }
    
    this.init = function() {
        $('#header').hide();
        $('#tabs').hide();

        drink.ajax({
            url: '/drink/currentuser'
        }, function(user) {
            gotUser(user);
            $('#header').show();
            $('#tabs').show();
            drink.tab.init();
        }, function() {
            drink.log("Error getting current user");
            // Don't auto refresh here, for fear of continuously refreshing
            alert("Error, please refresh.");
        });
    }
    
    this.current = function() {
        return current_user;
    }
    
    this.updated = function(userinfo) {
        if(userinfo && current_user.username == userinfo.username) {
            gotUser(userinfo);
        } else
            drink.log("Not accepting updated user - different username")
    }
    
    return this;
})();

drink.tab = new (function() {
    var self = this;
    var tab_elem;
    var selected;

    var update_user = function(e, userinfo) {
        tab_elem.data('disabled.tabs', []);
        for(var tab in drink.tabs) {
            var t = drink.tabs[tab];

            if(t.admin_required && !userinfo.admin) {
                idx = tab_elem.tabs('idx', tab);
                if(idx == -1)
                    drink.log("Broken! can't find tab");

                if(selected == idx) {
                    // TODO: figure out first legit tab to select
                    tab_elem.tabs('select', 0);
                }

                tab_elem.tabs('disable', idx );
            }
        }
    }
    
    var tabSelected = function(e, ui) {
        if(selected == tab_elem.data('selected.tabs')) {
            drink.log("!!! Same tab selected");
        }
        
        var newTab = false;
        for(var tab in drink.tabs) {
            if(tab_elem.tabs('idx', tab) == ui.index)
                newTab = tab;
        }
        
        if(!newTab) {
            drink.log("!!! can't find tab");
            return;
        }
        
        if(drink.tabs[self.selectedTab].hide_tab && typeof drink.tabs[self.selectedTab].hide_tab == 'function')
            drink.tabs[self.selectedTab].hide_tab();
        if(drink.tabs[newTab].show_tab && typeof drink.tabs[newTab].show_tab == 'function')
            drink.tabs[newTab].show_tab();
        
        selected = ui.index;
        self.selectedTab = newTab;
    }
    
    this.selectedTab = '';

    this.init = function() {
        tab_elem = $('#tabs > ul').tabs({cookie: {expires: 7, path: '/', secure: true}, cookieName: 'main'});
        selected = tab_elem.data('selected.tabs');
        for(var tab in drink.tabs)
            if(tab_elem.tabs('idx', tab) == selected)
                self.selectedTab = tab;
        tab_elem.bind('tabsshow', tabSelected);
        update_user(null, drink.user.current());
        
        $(window).bind('user.drink', update_user);
        $(window).bind('user.drink', function(e, userinfo) {
            for(var tab in drink.tabs) {
                if(drink.tabs[tab].user_update && typeof drink.tabs[tab].user_update == 'function')
                    drink.tabs[tab].user_update(userinfo);
            }
        });

        drink.log("Init Tabs");
        for(var tab in drink.tabs) {
            drink.log("... " + tab);
            drink.tabs[tab].init();
        }
        drink.log("End Tabs");
        
        if(drink.tabs[self.selectedTab].show_tab && typeof drink.tabs[self.selectedTab].show_tab == 'function')
            drink.tabs[self.selectedTab].show_tab();
    }
    
    return this;
})();

drink.tabs = {}

drink.tabs.temperatures = new (function() {
    var self = this;

    var last_update = false;
    var refresh_interval = 120;
    
    var Length = 60 * 60 * 4; // 4 hours of data
    var MaxBreak = 120; // Break the graph if there is more than 2 minutes between data points
    var plot = null;
    var plot_data = null;
        
    var gotTemps = function(data) {
        last_update = drink.time.nowUTC();
        plot_data = [];
        
        /* Convert to local time */
        data.start = data.start - drink.time.tz_offset;
        data.length = data.length - drink.time.tz_offset;
        for(var m in data.machines)
            for(var i in data.machines[m])
                data.machines[m][i][0] = data.machines[m][i][0] - drink.time.tz_offset;
        
        var max_time = data.start + data.length - 60;

        for(var m in data.machines) {
            if(data.machines[m].length == 0)
                continue;

            var prev = data.machines[m][0][0];
            var temps = {data: []};
            for(var i in data.machines[m]) {
                var t = data.machines[m][i];
                
                if(prev + MaxBreak < t[0])
                    temps.data.push([(prev + MaxBreak) * 1000, null]);
                
                if(max_time < t[0])
                    max_time = t[0];
                
                prev = t[0];
                temps.data.push([t[0] * 1000, t[1]]);
            }
            
            if(m == 'littledrink')
                temps.label = "Little Drink";
            else if(m == 'bigdrink')
                temps.label = "Big Drink";
            else
                temps.label = m;

            plot_data.push(temps);
        }
        
        plot = $.plot($('#temperature_plot'), plot_data,
            {xaxis: {mode: "time", min: data.start * 1000, max: max_time * 1000}});
    }
    
    var getTemps = function(From, Length) {
        drink.ajax({
            url: '/drink/temperatures',
            data: {from: From, length: Length}
        }, gotTemps);
    }
    
    this.admin_required = false;
    
    this.show_tab = function() {
        if(last_update == false || last_update + refresh_interval < drink.time.nowUTC())
            self.refresh();
    }
    
    this.refresh = function() {
        getTemps(drink.time.nowUTC() - Length, Length + 60);
    }
    
    this.init = function() {

    }
    
    return this;
})();

drink.tabs.logs = new (function () {
    var self = this;
    
    var last_update = false;
    var refresh_interval = 60;
    
    var offset = 0;
    var limit = 20;
    
    var gotLogs = function(data) {
        last_update = drink.time.nowUTC();
        
        if(data.start > 0)
            $('.logprev').show();
        else
            $('.logprev').hide();
        offset = data.start;
        $('.logoffset').html('' + offset);
        
        if(limit == data.lines.length)
            $('.lognext').show();
        else
            $('.lognext').hide();

        var logElem = $('#logcontainer').empty();
        var lines = [];

        for(var i = 0; i < data.lines.length; i++) {
            var l = data.lines[i];
            
            var time = drink.time.fromUTC(l.time);
            var d = drink.time.prettyDateTime(time);
            
            if(l.type == 'drop') {
                var error = l.status.search(/error/i) != -1;
                lines[lines.length] = [
                    '<tr', (error) ? ' class="error"' : '', '><td class="type">Drop</td><td class="time">', d,
                    '</td><td class="username">', l.username, 
                    '</td><td class="info">Dropped ', l.slot, ' from ', l.machine, '</td><td class="status">', l.status, '</td></tr>'
                ].join('');
            } else {
                var error = l.reason.search(/error/i) != -1;
                lines[lines.length] = [
                    '<tr', (error) ? ' class="error"' : '', '><td class="type">Money</td><td class="time">', d,
                    '</td><td class="username">', l.username,
                    '</td><td class="info">Admin: ', l.admin, ' Amount: ', l.amount, ' Direction: ', l.direction,
                    '</td><td class="reason">', l.reason, '</td></tr>'
                ].join('');
            }
        }
        logElem.append(lines.join(''));
    }
    
    this.admin_required = false;
    
    this.show_tab = function() {
        if(last_update == false || last_update + refresh_interval < drink.time.nowUTC())
            self.refresh();
    }

    this.refresh = function() {
        drink.ajax({
            url: '/drink/logs',
            data: {offset: offset, limit: limit}
        }, gotLogs);
    }
    
    this.user_update = function() {
        last_update = false;
        if(drink.tabs.selectedTab == 'logs')
            self.refresh();
    }
    
    this.init = function() {
        $('.logprev').click(function() {
            offset -= limit;
            offset = (offset > 0) ? offset : 0;
            self.refresh();
            return false;
        }).hide();
        
        $('.lognext').click(function() {
            offset += limit;
            self.refresh();
            return false;
        });
    }
    
    return this;
})();

drink.tabs.drink_machines = new (function() {
    var self = this;

    var last_update = false;
    var refresh_interval = 60;
    
    var machine_info = false;
    
    var pretty_available = function(count) {
        if(count == 0) {
            return 'Out';
        } else if(count == 1) {
            return 'Available';
        } else {
            return count;
        }
    }

    var slot_dom = function(machine, slot) {
        var droppable = false;
        droppable = (slot.available && machine.connected && (drink.user.current().credits >= slot.price));

        var s = $('<tr><td class="slotnum"></td><td class="slotname"></td><td class="slotprice"></td><td class="slotavail"></td><td class="slotactions"></td></tr>');
        
        if(slot.disabled)
            s.addClass('disabled');
        s.data('machine', machine.machineid);
        s.data('slotnum', slot.num);
        
        s.find('.slotnum').text(slot.num);
        s.find('.slotname').text(slot.name);
        s.find('.slotprice').text(slot.price);
        s.find('.slotavail').text(pretty_available(slot.available));
        var actions = s.find('.slotactions');
        
        $('<a class="slotaction_drop"> Drop </a>').appendTo(actions).click(function() {
            slot = $(this).parents('tr').eq(0);
            dropDelayAsk(slot.data('machine'), slot.data('slotnum'));
            return false;
        });
        $('<a class="slotaction_edit"> Edit </a>').appendTo(actions).click(function() {
            slot = $(this).parents('tr').eq(0);
            editSlot(slot.data('machine'), slot.data('slotnum'));
            return false;
        });
        $('<a class="slotaction_disable"></a>').text(slot.disabled ? ' Enable ' : ' Disable ').appendTo(actions).click(function() {
            slot = $(this).parents('tr').eq(0);
            toggleDisabled(slot.data('machine'), slot.data('slotnum'));
            return false;
        });
        
        return s;
    }
    
    var machine_edit_dom = function(machine) {
        var me = $('<form> \
            ID: <input type="text" class="machine_edit_id" /> Name: <input type="text" class="machine_edit_name" /> \
            Password: <input type="text" class="machine_edit_password" /><br /> \
            Public IP: <input type="text" class="machine_edit_public_ip" /> Machine IP: <input type="text" class="machine_edit_machine_ip" /><br /> \
            <input type="checkbox" class="machine_edit_available_sensor" value="true">Available Sensor</input> \
            <input type="checkbox" class="machine_edit_allow_connect" value="true">Allow Connect</input> \
            <input type="checkbox" class="machine_edit_admin_only" value="true">Admin Only</input><br /> \
            </form>');
        
        me.find('.machine_edit_id').val(machine.machineid);
        me.find('.machine_edit_name').val(machine.name);
        me.find('.machine_edit_password').val(machine.password);
        me.find('.machine_edit_public_ip').val(machine.public_ip);
        me.find('.machine_edit_machine_ip').val(machine.machine_ip);
        if(machine.available_sensor)
            me.find('.machine_edit_available_sensor').attr('checked', 'checked');
        if(machine.allow_connect)
            me.find('.machine_edit_allow_connect').attr('checked', 'checked');
        if(machine.admin_only)
            me.find('.machine_edit_admin_only').attr('checked', 'checked');
        me.submit(modMachine);
        
        return me;
    }

    var machine_dom = function(machine) {
        var m = $('<li><h3></h3><a class="machine_edit">(edit)</a> \
            <div class="machine_edit_form"></div>\
            <table><thead><tr><th>Slot Num</th><th>Name</th><th>Price</th><th>Available</th><th>Actions</th></tr></thead> \
            <tbody></tbody></table></li>');
        
        m.data('machine', machine.machineid);
        
        m.find('h3').text(machine.name);
        if(!machine.connected)
            m.addClass('disconnected');
            
        m.find('.machine_edit').click(function() {
            $(this).parents().eq(0).find('.machine_edit_form').toggle();
        });
        m.find('.machine_edit_form').append(machine_edit_dom(machine)).css('display', 'none');
        
        var slots = m.find('tbody');
        for(var slotnum in machine.slots) {
            machine.slots[slotnum].num = slotnum;
            slots.append(slot_dom(machine, machine.slots[slotnum]));
        }

        return m;
    }
    
    var gotMachines = function(data) {
        last_update = drink.time.nowUTC();
        
        machine_info = data;
        var machinelist = $('#machines').empty();
        for(var machine in data) {
            machinelist.append(machine_dom(data[machine]));
        }
        
        self.user_update(drink.user.current());
    }
    
    var set_slot_info = function(machine, num, name, price, available, disabled) {
        drink.ajax({
            url: '/drink/setslot',
            type: 'POST',
            data: { machine: machine, slot: num, name: name, price: price, available: available, disabled: disabled }
        }, gotMachines);
    }

    var editSlot = function(machine, slotnum) {
        var slot = machine_info[machine].slots[slotnum];
        var name = prompt("Name", slot.name);
        if(name == null || name == '')
            return;
        var price = prompt("Price", slot.price);
        if(price == null || price == '')
            return;
        var price = new Number(price);
        if(price == NaN || price < 0)
            return;
        var available = prompt("Available", slot.available);
        if(available == null || available == '')
            return;
        var available = new Number(available);
        if(available == NaN || available < 0)
            return;
        set_slot_info(machine, slotnum, name, price, available, slot.disabled);
    }
    
    var toggleDisabled = function(machine, slotnum) {
        var slot = machine_info[machine].slots[slotnum];
        set_slot_info(machine, slotnum, slot.name, slot.price, slot.available, !slot.disabled);
    }

    var drop = function(machine, slot) {
        var delay = 0;
        if(arguments.length == 3)
            delay = arguments[2];

        if(delay == null)
            return;
        
        if(delay > 0) {
            setTimeout(function() { drop(machine, slot) }, delay * 1000);
            return;
        }
        
        drink.ajax({
            url: '/drink/drop',
            type: 'POST',
            data: { machine: machine, slot: slot, delay: 0 }
        }, function() {
            alert('Dropping... RUN!');
        });
    }
    
    var dropDelayAsk = function(machine, slot) {
        var delay = prompt("Delay? Enter for immediate");
        if(delay == null)
            return; // Cancel
        if(delay == '')
            delay = 0;
        else
            delay = parseInt(delay);
        if(delay == NaN) {
            alert("Invalid Delay");
            return;
        }
        drop(machine, slot, delay);
    }
    
    var modMachine = function() {
        drink.log("Mod machine...");
    }
    
    this.admin_required = false;
    
    this.show_tab = function() {
        if(last_update == false || last_update + refresh_interval < drink.time.nowUTC())
            self.refresh();
    }
    
    this.user_update = function(userinfo) {
        var drops = $('#drink_machines .slotaction_drop');
        var admin = $('#drink_machines .slotaction_edit, #drink_machines .slotaction_disable, #drink_machines .machine_edit');
        
        // todo - droppable
        drops.each(function() {
            var row = $(this).parents('tr').eq(0);
            var machine = machine_info[$(row).data("machine")];
            var slot = machine.slots[$(row).data("slotnum")];
                
            var droppable = true;
            if(!machine.connected) droppable = false;
            if(!slot.available) droppable = false;
            if(slot.disabled) droppable = false;
            if(userinfo.credits < slot.price) droppable = false;
                
            if(droppable)
                $(this).show();
            else
                $(this).hide();
        });
        
        if(userinfo.admin) {
            admin.show();
        } else
            admin.hide();
    }
    
    this.refresh = function() {
        drink.ajax({
            url: '/drink/machines'
        }, gotMachines);
    }
    
    this.init = function() {
        
    }
    
    return this;
})();

drink.tabs.user_admin = new (function() {
    var self = this;
    
    var last_update = false;
    var current_edit_user = null;
    
    var get_user_info = function() {
        var username = $('#user_admin_username').val();
        if(username == 'username' || username == '')
            return false;
        
        drink.ajax({
            url: '/drink/userinfo',
            data: {user: username}
        }, got_user_info);

        return false;
    }

    var got_user_info = function(userinfo) {
        if(drink.user.current().username == userinfo.username) {
            drink.user.updated(userinfo);
        }
        
        current_edit_user = userinfo;

        $('#user_admin_user_username').text(current_edit_user.username);
        $('#user_admin_user_credits').text(current_edit_user.credits);
        $('#user_admin_user_admin').text(current_edit_user.admin);
        var ibuttons = $('#user_admin_user_ibuttons').empty();
        $.each(current_edit_user.ibuttons, function(n, ibutton) {
            var i = $('<li><span class="ibutton"></span> <a href="#">X</a></li>').appendTo(ibuttons).data("ibutton", ibutton);
            i.find('.ibutton').text(ibutton);
            i.find('a').click(removeiButton);
        });
        
        $('#user_admin > table').show();
    }

    var addiButton = function() {
        if(current_edit_user == null)
            return;
        var ibutton = prompt("Enter iButton:");
        if(ibutton == '' || ibutton == null)
            return;
        mod_user(current_edit_user.username, "addibutton", ibutton, '');
        
        return false;
    }

    var removeiButton = function() {
        if(current_edit_user == null)
            return;
        
        var ibutton = $(this).parents('li').eq(0).data("ibutton");
        if(confirm("Are you sure you want to delete: " + ibutton))
            mod_user(current_edit_user.username, "delibutton", ibutton, '');
        
        return false;
    }

    var modcredits_reason_change = function() {
        var reason = $('#user_admin_mod_reason');
        var credits = $('#user_admin_mod_credits');
        if(reason.val() == 'fix_amount' && credits.val() == '') {
            credits.val(current_edit_user.credits);
        }
        if(reason.val() == 'add_money' && credits.val() == '' + current_edit_user.credits) {
            credits.val('');
        }
    }

    var modcredits = function() {
        var diff = parseInt($('#user_admin_mod_credits').val());
        if(diff == NaN) {
            alert("Not a Number!");
            return;
        }
        var reason = $('#user_admin_mod_reason').val();
        if(reason == 'other') {
            while(reason == 'other' || reason == '')
                reason = prompt("Please enter reason: (lower case with underscores)");
            if(reason == null)
                return;
            if(!confirm("Press OK if the value is the difference of they're current balance, Cancel if it's the full value.")) {
                diff = diff - current_edit_user.credits;
            }
        } else if(reason == 'fix_amount') {
            diff = diff - current_edit_user.credits;
        }
        if(diff == 0)
            return;
        mod_user(current_edit_user.username, "modcredits", diff, reason);
        
        return false;
    }

    var toggle_admin = function() {
        if(current_edit_user == null)
            return;
        mod_user(current_edit_user.username, "admin", !current_edit_user.admin, '');
        
        return false;
    }

    var mod_user = function(username, attr, value, reason) {
        $('#user_admin_mod_form a').empty();
        $('#user_admin_mod_form form').empty();
        drink.ajax({
            url: '/drink/moduser',
            data: { username: username, attr: attr, value: value, reason: reason },
            type: 'POST'
        }, got_user_info);
    }
    
    this.admin_required = true;
    
    this.refresh = function() {
        
    }
    
    this.init = function() {
        $('#user_admin_username').unfocusColor('username', 'gray', 'black');
        
        $('#user_admin_get_form').submit(get_user_info);
        $('#user_admin_mod_credits_form').submit(modcredits);
        $('#user_admin_add_ibutton').click(addiButton);
        $('#user_admin_toggle_admin').click(toggle_admin);
        $('#user_admin_mod_reason').change(modcredits_reason_change);
        $('#user_admin > table').hide();
    }
    
    return this;
})();