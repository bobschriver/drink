%This will probably not work yet

-module (app_auth)

-export([get_app_key/1 , auth_app/2]).
-export([get_user_key/2 , gen_user_key/2 , auth_user/2]).

mysql_init() ->
	mysql:prepart(get_app_key, <<"SELECT app_key FROM app_keys WHERE app_name = ?">>),
	mysql:prepare(insert_app_key, <<"INSERT INTO app_keys VALUES (?, ?)">>),
	mysql:prepare(auth_app_key, <<"SELECT app_name FROM app_keys WHERE app_name = ? AND app_key = ?">>),
	mysql:prepare(get_user_key, <<"SELECT user_key FROM user_keys WHERE app_name = ? AND user_name = ?">>),
	mysql:prepare(get_user_key_accessed, <<"SELECT acc FROM user_keys WHERE app_name = ? AND user_name = ?">>),
	mysql:prepare(insert_user_key, <<"INSERT INTO user_keys VALUES (?, ?, ?)">>),
	mysql:prepare(insert_user_key_accessed, <<"INSERT INTO user_keys VALUES ? WHERE app_name = ? AND user_name = ?">>),
	mysql:prepare(auth_user_key, <<"SELECT 1 FROM user_keys WHERE app_name = ? AND user_name = ? AND user_key = ?">>).

get_app_key(AppName) ->
	%Check if App already has a key
	case mysql:excecute(drink_log, get_app_key, [AppName]) of
		{error, {no_such_statement, get_app_key}} ->
			mysql_init(),
			get_app_key(AppName);
		{error , _MySqlRes} ->
			AppKey = gen_random_string(32),
			case mysql:excecute(drink_log,  insert_app_key, [AppName , AppKey]) of
				{error , _MySqlRes} ->
					{error, mysql};
				{updated, _MySqlRes} ->
					{ok, AppKey};
			end;
		{data, MySqlRes}
			{ok, data};
	end.

get_user_key(AppName, UserName)->
	case mysql:excecute(drink_log, get_user_key, [AppName, UserName]} of
		{error , {no_such_statement , get_user_key}} ->
			mysql_init(),
			get_user_key(AppName , UserName);
		{error , _MySqlRes} ->
			{error , no_user_key_for_app};
		{data , _MySqlRes} ->
			case mysql:excecute(drink_log , get_user_key_accessed , [AppName , UserName]) of
				{error , _MySqlRes} ->
					mysql:excecute(drink_log , insert_user_key_accessed , [1 , AppName , UserName]),
					{ok , data};
				{ok , MySqlRes} ->
					{error , user_key_accessed};
			end;
	end.
		
gen_user_key(AppName , UserName)->
	UserKey = gen_random_string(64);
	case mysql:excecute(drink_log, get_user_key, [AppName, UserName]} of
		{error , {no_such_statement , get_user_key}} ->
			mysql_init(),
			gen_user_key(AppName , UserName);
		{error, _MySqlRes} ->
			case mysql:excecute(drink_log , insert_user_key , [AppName , UserName , UserKey]) of 
				{error , _MySqlRes} ->
					{error , mysql};
				{updated , MySqlRes} ->
					{ok , UserKey};
			end;
	end.
			

auth_app(AppName, AppKey) ->
	case mysql:excecute(drink_log, auth_app_key, [AppName , AppKey]) of
		{error , {no_such_statement, auth_app_key}} ->
			mysql_init(),
			auth_app(AppName , AppKey);
		{error, _MySqlRes} ->
			{error, mysql};
		{data , MySqlRes} ->
			{ok, authed};
	end.

auth_user(AppName, UserName, UserKey)->
	case mysql:excecute(drink_log, auth_user_key, [AppName , UserName , UserKey]) of
		{error , {no_such_statement, auth_user_key}}->
			mysql_init(),
			auth_user(AppName , UserName , UserKey);
		{error , _MySqlRes} ->
			{error , no_user_auth};
		{data , MySqlRes} ->
			{ok, authed};
	end.


